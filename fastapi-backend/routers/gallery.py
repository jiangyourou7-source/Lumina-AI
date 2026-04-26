from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import User, GalleryItem
from models.schemas import GalleryItemResponse, GalleryListResponse, GalleryItemCreate, MessageResponse
from core.security import get_current_user
from core.database import get_db

router = APIRouter(prefix="/api/gallery", tags=["gallery"])


@router.get("", response_model=GalleryListResponse)
async def get_gallery(
    category: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(GalleryItem).where(GalleryItem.user_id == user.id)
    count_query = select(func.count()).select_from(GalleryItem).where(GalleryItem.user_id == user.id)

    if category:
        query = query.where(GalleryItem.category == category)
        count_query = count_query.where(GalleryItem.category == category)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(GalleryItem.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return GalleryListResponse(
        items=[
            GalleryItemResponse(
                id=item.id,
                url=item.url,
                title=item.title,
                prompt=item.prompt,
                category=item.category,
                size=item.size,
                quality=item.quality,
                source=item.source,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
    )


@router.post("", response_model=GalleryItemResponse)
async def add_gallery_item(
    data: GalleryItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = GalleryItem(
        user_id=user.id,
        url=data.url,
        title=data.title,
        prompt=data.prompt,
        category=data.category,
        size=data.size,
        quality=data.quality,
        source=data.source,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return GalleryItemResponse(
        id=item.id,
        url=item.url,
        title=item.title,
        prompt=item.prompt,
        category=item.category,
        size=item.size,
        quality=item.quality,
        source=item.source,
        created_at=item.created_at,
    )


@router.delete("/{item_id}", response_model=MessageResponse)
async def delete_gallery_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GalleryItem).where(GalleryItem.id == item_id, GalleryItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="作品不存在")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="删除成功")
