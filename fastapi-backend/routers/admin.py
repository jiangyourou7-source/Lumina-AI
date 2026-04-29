import json
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, func, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_admin_user
from models.database import AdminActionLog, ImageGenerationLog, Quota, User
from models.schemas import (
    AdminGenerationLogItem,
    AdminGenerationLogsResponse,
    AdminStatsResponse,
    AdminUserItem,
    AdminUsersResponse,
    AdminVipLevelUpdate,
    MessageResponse,
)
from services.billing import VIP_QUOTAS

router = APIRouter(prefix="/api/admin", tags=["admin"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def day_start(days_ago: int = 0) -> datetime:
    base = utcnow().date() - timedelta(days=days_ago)
    return datetime.combine(base, time.min, tzinfo=timezone.utc)


async def scalar_count(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def successful_generation_sum(db: AsyncSession, since: datetime | None = None) -> int:
    stmt = select(func.coalesce(func.sum(ImageGenerationLog.success_count), 0)).where(
        ImageGenerationLog.status == "success"
    )
    if since:
        stmt = stmt.where(ImageGenerationLog.created_at >= since)
    return int((await db.execute(stmt)).scalar_one() or 0)


async def trend(db: AsyncSession, aggregate, date_column, since: datetime, status_success: bool = False):
    stmt = select(func.date(date_column).label("date"), aggregate.label("count"))
    if status_success:
        stmt = stmt.where(ImageGenerationLog.status == "success")
    stmt = stmt.where(date_column >= since).group_by(func.date(date_column)).order_by(func.date(date_column))
    rows = (await db.execute(stmt)).all()
    values = {str(row.date): int(row.count or 0) for row in rows}
    days = []
    for offset in range(6, -1, -1):
        date_key = (utcnow().date() - timedelta(days=offset)).isoformat()
        days.append({"date": date_key, "count": values.get(date_key, 0)})
    return days


def admin_user_item(user: User) -> AdminUserItem:
    return AdminUserItem(
        id=user.id,
        email=user.email,
        phone=getattr(user, "phone", None),
        nickname=user.name,
        avatar=user.avatar,
        role=getattr(user, "role", "user"),
        vip_level=getattr(user, "vip_level", "normal"),
        image_quota_total=int(getattr(user, "image_quota_total", 0) or 0),
        image_quota_used=int(getattr(user, "image_quota_used", 0) or 0),
        image_quota_remaining=int(getattr(user, "image_quota_remaining", 0) or 0),
        status=getattr(user, "status", "active"),
        created_at=user.created_at,
        last_login_at=getattr(user, "last_login_at", None),
    )


async def add_action_log(
    db: AsyncSession,
    admin: User,
    target: User,
    action_type: str,
    before_value: dict,
    after_value: dict,
):
    db.add(
        AdminActionLog(
            admin_user_id=admin.id,
            target_user_id=target.id,
            action_type=action_type,
            before_value=json.dumps(before_value, ensure_ascii=False),
            after_value=json.dumps(after_value, ensure_ascii=False),
        )
    )


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    today = day_start(0)
    last7 = day_start(6)
    last30 = day_start(29)

    total_users = await scalar_count(db, select(func.count(User.id)))
    active_accounts = await scalar_count(db, select(func.count(User.id)).where(User.status == "active"))
    disabled_accounts = await scalar_count(db, select(func.count(User.id)).where(User.status == "disabled"))
    vip_accounts = await scalar_count(db, select(func.count(User.id)).where(User.vip_level.in_(["vip1", "vip2", "vip3"])))

    return AdminStatsResponse(
        totalUsers=total_users,
        todayNewUsers=await scalar_count(db, select(func.count(User.id)).where(User.created_at >= today)),
        last7DaysNewUsers=await scalar_count(db, select(func.count(User.id)).where(User.created_at >= last7)),
        last30DaysNewUsers=await scalar_count(db, select(func.count(User.id)).where(User.created_at >= last30)),
        totalAccounts=total_users,
        activeAccounts=active_accounts,
        disabledAccounts=disabled_accounts,
        vipAccounts=vip_accounts,
        totalImageGenerations=await successful_generation_sum(db),
        todayImageGenerations=await successful_generation_sum(db, today),
        last7DaysImageGenerations=await successful_generation_sum(db, last7),
        last30DaysImageGenerations=await successful_generation_sum(db, last30),
        registrationTrend=await trend(db, func.count(User.id), User.created_at, last7),
        generationTrend=await trend(
            db,
            func.coalesce(func.sum(ImageGenerationLog.success_count), 0),
            ImageGenerationLog.created_at,
            last7,
            True,
        ),
    )


@router.get("/users", response_model=AdminUsersResponse)
async def list_admin_users(
    keyword: str | None = Query(default=None),
    vipLevel: str | None = Query(default=None),
    status: str | None = Query(default=None),
    createdFrom: datetime | None = Query(default=None),
    createdTo: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if keyword:
        like = f"%{keyword.strip()}%"
        keyword_filters = [User.email.ilike(like), User.name.ilike(like)]
        if keyword.strip().isdigit():
            keyword_filters.append(User.id == int(keyword.strip()))
        if hasattr(User, "phone"):
            keyword_filters.append(User.phone.ilike(like))
        filters.append(or_(*keyword_filters))
    if vipLevel:
        filters.append(User.vip_level == vipLevel)
    if status:
        filters.append(User.status == status)
    if createdFrom:
        filters.append(User.created_at >= createdFrom)
    if createdTo:
        filters.append(User.created_at <= createdTo)

    where_clause = and_(*filters) if filters else true()
    total = await scalar_count(db, select(func.count(User.id)).where(where_clause))
    result = await db.execute(
        select(User)
        .where(where_clause)
        .order_by(desc(User.created_at))
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    )
    users = result.scalars().all()
    return AdminUsersResponse(
        items=[admin_user_item(user) for user in users],
        total=total,
        page=page,
        pageSize=pageSize,
    )


@router.post("/users/{user_id}/vip-level", response_model=AdminUserItem)
async def update_user_vip_level(
    user_id: int,
    payload: AdminVipLevelUpdate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    before = {
        "vip_level": target.vip_level,
        "image_quota_total": target.image_quota_total,
        "image_quota_used": target.image_quota_used,
        "image_quota_remaining": target.image_quota_remaining,
    }
    target.vip_level = payload.vipLevel
    target.plan = payload.vipLevel
    target.image_quota_total = VIP_QUOTAS[payload.vipLevel]
    target.image_quota_used = int(target.image_quota_used or 0)
    target.image_quota_remaining = max(target.image_quota_total - target.image_quota_used, 0)
    quota_result = await db.execute(select(Quota).where(Quota.user_id == target.id))
    quota = quota_result.scalar_one_or_none()
    if quota:
        quota.total_quota = target.image_quota_total
        quota.used_quota = target.image_quota_used
    else:
        db.add(Quota(user_id=target.id, total_quota=target.image_quota_total, used_quota=target.image_quota_used))
    after = {
        "vip_level": payload.vipLevel,
        "image_quota_total": VIP_QUOTAS[payload.vipLevel],
        "image_quota_used": target.image_quota_used,
        "image_quota_remaining": target.image_quota_remaining,
    }
    await add_action_log(db, admin, target, "update_vip_level", before, after)
    await db.commit()
    await db.refresh(target)
    return admin_user_item(target)


@router.post("/users/{user_id}/disable", response_model=MessageResponse)
async def disable_user(
    user_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="不能禁用当前管理员账号")

    before = {"status": target.status}
    target.status = "disabled"
    await add_action_log(db, admin, target, "disable_user", before, {"status": "disabled"})
    await db.commit()
    return MessageResponse(message="账号已禁用")


@router.post("/users/{user_id}/enable", response_model=MessageResponse)
async def enable_user(
    user_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    before = {"status": target.status}
    target.status = "active"
    await add_action_log(db, admin, target, "enable_user", before, {"status": "active"})
    await db.commit()
    return MessageResponse(message="账号已启用")


@router.get("/users/{user_id}/generation-logs", response_model=AdminGenerationLogsResponse)
async def get_user_generation_logs(
    user_id: int,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total = await scalar_count(
        db,
        select(func.count(ImageGenerationLog.id)).where(ImageGenerationLog.user_id == user_id),
    )
    result = await db.execute(
        select(ImageGenerationLog)
        .where(ImageGenerationLog.user_id == user_id)
        .order_by(desc(ImageGenerationLog.created_at))
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    )
    logs = result.scalars().all()
    return AdminGenerationLogsResponse(
        items=[
            AdminGenerationLogItem(
                id=log.id,
                user_id=log.user_id,
                prompt=log.prompt,
                aspect_ratio=log.aspect_ratio,
                quality=log.quality,
                image_count=log.image_count,
                success_count=int(getattr(log, "success_count", 0) or 0),
                failed_count=int(getattr(log, "failed_count", 0) or 0),
                status=log.status,
                quota_used=log.quota_used,
                created_at=log.created_at,
            )
            for log in logs
        ],
        total=total,
    )
