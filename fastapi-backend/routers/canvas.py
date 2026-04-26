from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import User
from models.schemas import (
    CanvasSaveRequest,
    CanvasUpdateRequest,
    CanvasResponse,
    CanvasListResponse,
    MessageResponse,
)
from services.canvas_service import save_canvas, get_canvas, list_canvases, update_canvas, delete_canvas
from core.security import get_current_user
from core.database import get_db

router = APIRouter(prefix="/api/canvas", tags=["canvas"])


@router.post("", response_model=CanvasResponse)
async def create_canvas(
    data: CanvasSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await save_canvas(db, user.id, data)
    return CanvasResponse(
        id=canvas.id,
        title=canvas.title,
        canvas_data=canvas.canvas_data,
        thumbnail=canvas.thumbnail,
        version=canvas.version,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.get("", response_model=CanvasListResponse)
async def get_canvas_list(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_canvases(db, user.id, limit, offset)
    return CanvasListResponse(
        items=[
            CanvasResponse(
                id=c.id,
                title=c.title,
                canvas_data=c.canvas_data,
                thumbnail=c.thumbnail,
                version=c.version,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in items
        ],
        total=total,
    )


@router.get("/{canvas_id}", response_model=CanvasResponse)
async def get_canvas_detail(
    canvas_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await get_canvas(db, canvas_id, user.id)
    if not canvas:
        raise HTTPException(status_code=404, detail="画布不存在")
    return CanvasResponse(
        id=canvas.id,
        title=canvas.title,
        canvas_data=canvas.canvas_data,
        thumbnail=canvas.thumbnail,
        version=canvas.version,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.put("/{canvas_id}", response_model=CanvasResponse)
async def update_canvas_api(
    canvas_id: int,
    data: CanvasUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await update_canvas(db, canvas_id, user.id, data)
    if not canvas:
        raise HTTPException(status_code=404, detail="画布不存在")
    return CanvasResponse(
        id=canvas.id,
        title=canvas.title,
        canvas_data=canvas.canvas_data,
        thumbnail=canvas.thumbnail,
        version=canvas.version,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.delete("/{canvas_id}", response_model=MessageResponse)
async def delete_canvas_api(
    canvas_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await delete_canvas(db, canvas_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="画布不存在")
    return MessageResponse(message="画布已删除")
