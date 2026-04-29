import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.database import GalleryItem, ImageGenerationLog, User
from models.schemas import GenerateRequest, GenerateResponse
from services.billing import check_quota, deduct_quota, should_show_promo_popup
from services.image_service import ImageServiceError, generate_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/generate", tags=["generate"])
alias_router = APIRouter(prefix="/api/generate-image", tags=["generate"])


async def add_generation_log(
    db: AsyncSession,
    user_id: int,
    req: GenerateRequest,
    status: str,
    quota_used: int,
    success_count: int,
    failed_count: int,
):
    db.add(
        ImageGenerationLog(
            user_id=user_id,
            prompt=req.prompt,
            aspect_ratio=req.size,
            quality=req.quality,
            image_count=1,
            success_count=success_count,
            failed_count=failed_count,
            status=status,
            quota_used=quota_used,
        )
    )


async def run_generate(
    req: GenerateRequest,
    user: User,
    db: AsyncSession,
):
    try:
        await check_quota(db, user, 1)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        url = await generate_image(req.prompt, req.size, req.resolution, req.quality, req.model)
        remaining = await deduct_quota(db, user, 1)
        show_promo = should_show_promo_popup(user)

        db.add(
            GalleryItem(
                user_id=user.id,
                url=url,
                title=req.prompt[:50] if len(req.prompt) > 50 else req.prompt,
                prompt=req.prompt,
                category="其他",
                size=req.size,
                quality=req.quality,
                source="generate",
            )
        )
        await add_generation_log(db, user.id, req, "success", 1, 1, 0)
        await db.commit()

        return GenerateResponse(url=url, remaining_quota=remaining, shouldShowPromoPopup=show_promo)
    except ImageServiceError as e:
        await add_generation_log(db, user.id, req, "failed", 0, 0, 1)
        await db.commit()
        logger.error("Image generation failed: %s", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        await add_generation_log(db, user.id, req, "failed", 0, 0, 1)
        await db.commit()
        logger.error("Image generation failed: %s", str(e))
        raise HTTPException(status_code=500, detail="图片生成服务异常，请稍后重试")


@router.post("", response_model=GenerateResponse)
async def generate(
    req: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await run_generate(req, user, db)


@alias_router.post("", response_model=GenerateResponse)
async def generate_image_alias(
    req: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await run_generate(req, user, db)
