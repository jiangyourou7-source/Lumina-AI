from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import User, Quota
from core.config import FREE_MONTHLY_QUOTA, PRO_MONTHLY_QUOTA

PLAN_QUOTAS = {
    "free": FREE_MONTHLY_QUOTA,
    "pro": PRO_MONTHLY_QUOTA,
    "enterprise": 999999,
}


def _utcnow():
    return datetime.now(timezone.utc)


async def get_or_create_quota(db: AsyncSession, user: User) -> Quota:
    result = await db.execute(select(Quota).where(Quota.user_id == user.id))
    quota = result.scalar_one_or_none()

    if quota is None:
        quota = Quota(
            user_id=user.id,
            total_quota=PLAN_QUOTAS.get(user.plan, FREE_MONTHLY_QUOTA),
            used_quota=0,
            period_start=_utcnow(),
        )
        db.add(quota)
        await db.commit()
        await db.refresh(quota)

    plan_quota = PLAN_QUOTAS.get(user.plan, FREE_MONTHLY_QUOTA)
    if quota.total_quota != plan_quota:
        quota.total_quota = plan_quota
        quota.used_quota = min(quota.used_quota, plan_quota)
        await db.commit()
        await db.refresh(quota)

    now = _utcnow()
    period_start = quota.period_start
    if period_start and period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=timezone.utc)

    if period_start:
        days_since_start = (now - period_start).days
        if days_since_start >= 30:
            quota.total_quota = PLAN_QUOTAS.get(user.plan, FREE_MONTHLY_QUOTA)
            quota.used_quota = 0
            quota.period_start = now
            await db.commit()
            await db.refresh(quota)

    return quota


async def check_quota(db: AsyncSession, user: User) -> Quota:
    quota = await get_or_create_quota(db, user)
    if quota.used_quota >= quota.total_quota:
        raise ValueError(f"额度不足，当前计划 {user.plan} 每月 {quota.total_quota} 次，已用 {quota.used_quota} 次")
    return quota


async def deduct_quota(db: AsyncSession, user: User) -> int:
    quota = await get_or_create_quota(db, user)
    quota.used_quota += 1
    await db.commit()
    await db.refresh(quota)
    return quota.total_quota - quota.used_quota


async def get_quota_info(db: AsyncSession, user: User) -> dict:
    quota = await get_or_create_quota(db, user)
    return {
        "total": quota.total_quota,
        "used": quota.used_quota,
        "remaining": quota.total_quota - quota.used_quota,
        "plan": user.plan,
    }
