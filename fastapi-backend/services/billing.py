from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import (
    FREE_MONTHLY_QUOTA,
    PROMO_VIP2_BONUS_QUOTA,
    VIP1_IMAGE_QUOTA,
    VIP1_PRICE,
    VIP2_IMAGE_QUOTA,
    VIP2_PRICE,
    VIP3_IMAGE_QUOTA,
    VIP3_PRICE,
)
from models.database import ImageGenerationLog, Order, Quota, User

PLAN_PRICES = {
    "vip1": VIP1_PRICE,
    "vip2": VIP2_PRICE,
    "vip3": VIP3_PRICE,
}

VIP_QUOTAS = {
    "vip1": VIP1_IMAGE_QUOTA,
    "vip2": VIP2_IMAGE_QUOTA,
    "vip3": VIP3_IMAGE_QUOTA,
}

PLAN_DISPLAY_NAMES = {
    "free": "免费用户",
    "vip1": "VIP1",
    "vip2": "VIP2",
    "vip3": "VIP3",
}


def _utcnow():
    return datetime.now(timezone.utc)


def normalize_plan(user: User) -> str:
    plan = (getattr(user, "plan", None) or "free").lower()
    vip_level = (getattr(user, "vip_level", None) or "").lower()
    if plan in VIP_QUOTAS:
        return plan
    if vip_level in VIP_QUOTAS:
        return vip_level
    return "free"


def list_plans() -> list[dict]:
    return [
        {"plan": "vip1", "name": "VIP1", "price": VIP1_PRICE, "quota": VIP1_IMAGE_QUOTA},
        {"plan": "vip2", "name": "VIP2", "price": VIP2_PRICE, "quota": VIP2_IMAGE_QUOTA},
        {"plan": "vip3", "name": "VIP3", "price": VIP3_PRICE, "quota": VIP3_IMAGE_QUOTA},
    ]


async def get_or_create_quota(db: AsyncSession, user: User) -> Quota:
    total_quota = int(getattr(user, "image_quota_total", 0) or FREE_MONTHLY_QUOTA)
    used_quota = int(getattr(user, "image_quota_used", 0) or 0)

    user.image_quota_total = total_quota
    user.image_quota_used = used_quota
    user.image_quota_remaining = max(total_quota - used_quota, 0)

    result = await db.execute(select(Quota).where(Quota.user_id == user.id))
    quota = result.scalar_one_or_none()

    if quota is None:
        quota = Quota(
            user_id=user.id,
            total_quota=total_quota,
            used_quota=used_quota,
            period_start=_utcnow(),
        )
        db.add(quota)
        await db.flush()
        return quota

    if quota.total_quota != total_quota or quota.used_quota != used_quota:
        quota.total_quota = total_quota
        quota.used_quota = used_quota
        await db.flush()

    return quota


async def sync_user_quota(db: AsyncSession, user: User) -> int:
    quota = await get_or_create_quota(db, user)
    user.image_quota_total = int(quota.total_quota or 0)
    user.image_quota_used = int(quota.used_quota or 0)
    user.image_quota_remaining = max(user.image_quota_total - user.image_quota_used, 0)
    await db.flush()
    return user.image_quota_remaining


async def check_quota(db: AsyncSession, user: User, image_count: int = 1) -> Quota:
    if getattr(user, "status", "active") == "disabled":
        raise ValueError("账号已被禁用，请联系管理员。")

    quota = await get_or_create_quota(db, user)
    remaining = int(quota.total_quota or 0) - int(quota.used_quota or 0)
    if remaining <= 0 and normalize_plan(user) == "free":
        raise ValueError("免费生图次数已用完，请升级 VIP 套餐继续生成。")
    if remaining < image_count:
        raise ValueError("当前剩余生图额度不足，请升级套餐后继续生成。")
    return quota


async def deduct_quota(db: AsyncSession, user: User, image_count: int = 1) -> int:
    quota = await get_or_create_quota(db, user)
    quota.used_quota = int(quota.used_quota or 0) + image_count
    user.image_quota_total = int(quota.total_quota or 0)
    user.image_quota_used = int(quota.used_quota or 0)
    user.image_quota_remaining = max(user.image_quota_total - user.image_quota_used, 0)
    if normalize_plan(user) == "free":
        user.free_generation_count = int(getattr(user, "free_generation_count", 0) or 0) + image_count
    await db.flush()
    return user.image_quota_remaining


def should_show_promo_popup(user: User) -> bool:
    return (
        normalize_plan(user) == "free"
        and int(getattr(user, "free_generation_count", 0) or 0) >= 3
        and not bool(getattr(user, "promo_popup_shown", False))
    )


async def set_user_vip_level(db: AsyncSession, user: User, vip_level: str, total_quota: int | None = None) -> int:
    if vip_level not in VIP_QUOTAS:
        raise ValueError("Unsupported VIP level")

    user.vip_level = vip_level
    user.plan = vip_level
    user.image_quota_total = int(total_quota or VIP_QUOTAS[vip_level])
    user.image_quota_used = 0
    user.image_quota_remaining = user.image_quota_total

    result = await db.execute(select(Quota).where(Quota.user_id == user.id))
    quota = result.scalar_one_or_none()
    if quota:
        quota.total_quota = user.image_quota_total
        quota.used_quota = 0
    else:
        db.add(Quota(user_id=user.id, total_quota=user.image_quota_total, used_quota=0, period_start=_utcnow()))

    await db.flush()
    return user.image_quota_remaining


async def get_recent_generation_logs(db: AsyncSession, user: User, limit: int = 10) -> list[dict]:
    result = await db.execute(
        select(ImageGenerationLog)
        .where(ImageGenerationLog.user_id == user.id)
        .order_by(desc(ImageGenerationLog.created_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "createdAt": log.created_at,
            "imageCount": int(log.image_count or 0),
            "successCount": int(getattr(log, "success_count", 0) or 0),
            "failedCount": int(getattr(log, "failed_count", 0) or 0),
            "quotaUsed": int(log.quota_used or 0),
            "status": log.status,
        }
        for log in logs
    ]


async def get_quota_info(db: AsyncSession, user: User, include_logs: bool = False) -> dict:
    quota = await get_or_create_quota(db, user)
    plan = normalize_plan(user)
    data = {
        "plan": plan,
        "planLabel": PLAN_DISPLAY_NAMES.get(plan, plan),
        "imageQuotaTotal": int(quota.total_quota or 0),
        "imageQuotaUsed": int(quota.used_quota or 0),
        "imageQuotaRemaining": max(int(quota.total_quota or 0) - int(quota.used_quota or 0), 0),
        "freeGenerationCount": int(getattr(user, "free_generation_count", 0) or 0),
        "promoPopupShown": bool(getattr(user, "promo_popup_shown", False)),
        "promoVip2Used": bool(getattr(user, "promo_vip2_used", False)),
    }
    if include_logs:
        data["recentGenerationLogs"] = await get_recent_generation_logs(db, user)
    return data


def legacy_quota_info(quota_info: dict) -> dict:
    return {
        "total": quota_info["imageQuotaTotal"],
        "used": quota_info["imageQuotaUsed"],
        "remaining": quota_info["imageQuotaRemaining"],
        "plan": quota_info["plan"],
    }


async def create_order(db: AsyncSession, user: User, plan: str, order_type: str = "normal") -> Order:
    plan = plan.lower()
    order_type = order_type.lower()
    if plan not in VIP_QUOTAS:
        raise ValueError("不支持的 VIP 套餐")
    if order_type not in {"normal", "promo_vip2"}:
        raise ValueError("不支持的订单类型")
    if order_type == "promo_vip2":
        if plan != "vip2":
            raise ValueError("优惠订单仅支持 VIP2")
        if int(getattr(user, "free_generation_count", 0) or 0) < 3:
            raise ValueError("暂未满足 VIP2 优惠资格")
        if bool(getattr(user, "promo_vip2_used", False)):
            raise ValueError("该账号已使用过 VIP2 优惠")

    base_quota = VIP_QUOTAS[plan]
    bonus_quota = PROMO_VIP2_BONUS_QUOTA if order_type == "promo_vip2" else 0
    order = Order(
        user_id=user.id,
        plan=plan,
        price=PLAN_PRICES[plan],
        base_quota=base_quota,
        bonus_quota=bonus_quota,
        total_quota=base_quota + bonus_quota,
        order_type=order_type,
        payment_status="pending",
    )
    db.add(order)
    await db.flush()
    return order


async def mark_order_paid(db: AsyncSession, user: User, order_id: int) -> Order:
    order = await db.get(Order, order_id)
    if not order or order.user_id != user.id:
        raise ValueError("订单不存在")
    if order.payment_status == "paid":
        return order
    if order.payment_status != "pending":
        raise ValueError("订单当前状态不可支付")
    if order.order_type == "promo_vip2" and bool(getattr(user, "promo_vip2_used", False)):
        order.payment_status = "failed"
        raise ValueError("该账号已使用过 VIP2 优惠")

    order.payment_status = "paid"
    order.paid_at = _utcnow()
    await set_user_vip_level(db, user, order.plan, order.total_quota)
    if order.order_type == "promo_vip2":
        user.promo_vip2_used = True
    await db.flush()
    return order
