import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.database import GalleryItem, ImageGenerationLog, User
from models.schemas import EditResponse, PortraitComposeRequest, PortraitReference
from services.billing import check_quota, deduct_quota
from services.image_service import ImageServiceError, compose_portrait_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portrait", tags=["portrait"])

ROLE_PROMPTS = {
    "person": "人物主体：保持人物脸部身份、五官特征、身形气质，不要随意换脸。",
    "top": "上衣参考：提取版型、颜色、材质和图案，用在人物穿搭上。",
    "pants": "裤子/下装参考：提取版型、颜色、材质和搭配方式。",
    "shoes": "鞋子参考：提取鞋型、颜色、材质和穿着效果。",
    "accessory": "饰品参考：作为配饰融入造型，保持比例自然。",
    "background": "背景参考：作为写真场景或空间氛围使用。",
    "style": "风格参考：只提取光影、色调、构图和摄影风格。",
    "other": "其他参考：作为辅助视觉参考。",
}


def _build_portrait_prompt(user_prompt: str, references: list[PortraitReference]) -> str:
    lines = [
        "你是商业写真生成助手。请根据以下多张参考图生成一张自然、真实、精修质感的写真照。",
        "优先保持人物主体身份一致，让服装、裤子、鞋子、饰品和背景像真实拍摄一样融合。",
        "不要把参考图简单拼贴到画面里，不要出现多余肢体、错位衣服、畸形手脚或重复人物。",
        "",
        f"用户成片要求：{user_prompt}",
        "",
        "参考素材说明：",
    ]
    for index, item in enumerate(references, start=1):
        role_note = ROLE_PROMPTS.get(item.role, ROLE_PROMPTS["other"])
        label = f"（{item.label}）" if item.label else ""
        lines.append(f"{index}. {role_note}{label}")
    return "\n".join(lines)


async def add_portrait_log(
    db: AsyncSession,
    user_id: int,
    req: PortraitComposeRequest,
    prompt: str,
    status: str,
    quota_used: int,
):
    db.add(
        ImageGenerationLog(
            user_id=user_id,
            prompt=prompt,
            aspect_ratio=req.size,
            quality=req.quality,
            image_count=1,
            status=status,
            quota_used=quota_used,
        )
    )


@router.post("/compose", response_model=EditResponse)
async def compose_portrait(
    req: PortraitComposeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await check_quota(db, user, 1)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not any(item.role == "person" for item in req.references):
        raise HTTPException(status_code=400, detail="请先上传并标记人物主体素材")

    composed_prompt = _build_portrait_prompt(req.prompt, req.references)
    try:
        url = await compose_portrait_image(
            [item.image_url for item in req.references],
            composed_prompt,
            req.size,
            req.resolution,
            req.quality,
            req.model,
        )
        remaining = await deduct_quota(db, user, 1)

        db.add(
            GalleryItem(
                user_id=user.id,
                url=url,
                title=req.prompt[:50] if len(req.prompt) > 50 else req.prompt,
                prompt=composed_prompt,
                category="AI 写真",
                size=req.size,
                quality=req.quality,
                source="portrait-compose",
            )
        )
        await add_portrait_log(db, user.id, req, composed_prompt, "success", 1)
        await db.commit()

        return EditResponse(url=url, remaining_quota=remaining)
    except ImageServiceError as e:
        await add_portrait_log(db, user.id, req, composed_prompt, "failed", 0)
        await db.commit()
        logger.error("AI portrait compose failed: %s", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        await add_portrait_log(db, user.id, req, composed_prompt, "failed", 0)
        await db.commit()
        logger.error("AI portrait compose failed: %s", str(e))
        raise HTTPException(status_code=500, detail="AI 写真生成服务异常，请稍后重试")
