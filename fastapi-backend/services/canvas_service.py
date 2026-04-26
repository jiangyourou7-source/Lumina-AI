from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import Canvas
from models.schemas import CanvasSaveRequest, CanvasUpdateRequest


async def save_canvas(db: AsyncSession, user_id: int, data: CanvasSaveRequest) -> Canvas:
    canvas = Canvas(
        user_id=user_id,
        title=data.title,
        canvas_data=data.canvas_data,
        thumbnail=data.thumbnail,
    )
    db.add(canvas)
    await db.commit()
    await db.refresh(canvas)
    return canvas


async def get_canvas(db: AsyncSession, canvas_id: int, user_id: int) -> Canvas | None:
    result = await db.execute(
        select(Canvas).where(Canvas.id == canvas_id, Canvas.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_canvases(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> tuple[list[Canvas], int]:
    count_result = await db.execute(
        select(func.count()).select_from(Canvas).where(Canvas.user_id == user_id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Canvas)
        .where(Canvas.user_id == user_id)
        .order_by(Canvas.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return items, total


async def update_canvas(db: AsyncSession, canvas_id: int, user_id: int, data: CanvasUpdateRequest) -> Canvas | None:
    canvas = await get_canvas(db, canvas_id, user_id)
    if canvas is None:
        return None

    if data.title is not None:
        canvas.title = data.title
    if data.canvas_data is not None:
        canvas.canvas_data = data.canvas_data
        canvas.version += 1
    if data.thumbnail is not None:
        canvas.thumbnail = data.thumbnail

    await db.commit()
    await db.refresh(canvas)
    return canvas


async def delete_canvas(db: AsyncSession, canvas_id: int, user_id: int) -> bool:
    canvas = await get_canvas(db, canvas_id, user_id)
    if canvas is None:
        return False
    await db.delete(canvas)
    await db.commit()
    return True
