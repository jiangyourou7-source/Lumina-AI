import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.database import GalleryItem, ImageGenerationLog, User
from models.schemas import EditRequest, EditResponse
from services.billing import check_quota, deduct_quota
from services.image_service import ImageServiceError, edit_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/edit", tags=["edit"])


async def add_edit_log(
    db: AsyncSession,
    user_id: int,
    req: EditRequest,
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


@router.post("", response_model=EditResponse)
async def edit(
    req: EditRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await check_quota(db, user, 1)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        url = await edit_image(req.image_url, req.prompt, req.size, req.resolution, req.quality, req.model)
        remaining = await deduct_quota(db, user, 1)

        db.add(
            GalleryItem(
                user_id=user.id,
                url=url,
                title=req.prompt[:50] if len(req.prompt) > 50 else req.prompt,
                prompt=req.prompt,
                category="其他",
                source="edit",
            )
        )
        await add_edit_log(db, user.id, req, "success", 1, 1, 0)
        await db.commit()

        return EditResponse(url=url, remaining_quota=remaining)
    except ImageServiceError as e:
        await add_edit_log(db, user.id, req, "failed", 0, 0, 1)
        await db.commit()
        logger.error("Image edit failed: %s", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        await add_edit_log(db, user.id, req, "failed", 0, 0, 1)
        await db.commit()
        logger.error("Image edit failed: %s", str(e))
        raise HTTPException(status_code=500, detail="图片编辑服务异常，请稍后重试")
