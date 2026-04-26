import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import User, GalleryItem
from models.schemas import GenerateRequest, GenerateResponse
from services.image_service import generate_image
from services.image_service import ImageServiceError
from services.billing import check_quota, deduct_quota
from core.security import get_current_user
from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/generate", tags=["generate"])


@router.post("", response_model=GenerateResponse)
async def generate(
    req: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await check_quota(db, user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        url = await generate_image(req.prompt, req.size, req.resolution, req.quality, req.model)
        remaining = await deduct_quota(db, user)

        gallery_item = GalleryItem(
            user_id=user.id,
            url=url,
            title=req.prompt[:50] if len(req.prompt) > 50 else req.prompt,
            prompt=req.prompt,
            category="其他",
            size=req.size,
            quality=req.quality,
            source="generate",
        )
        db.add(gallery_item)
        await db.commit()

        return GenerateResponse(url=url, remaining_quota=remaining)
    except ImageServiceError as e:
        logger.error(f"生成失败: {str(e)}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"生成失败: {str(e)}")
        raise HTTPException(status_code=500, detail="图片生成服务异常，请稍后重试")
