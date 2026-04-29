import hmac
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PAYMENT_WEBHOOK_SECRET, PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
from core.database import get_db
from core.security import get_current_user
from models.database import Order, User
from models.schemas import (
    MessageResponse,
    OrderCreateRequest,
    OrderPaymentCallbackRequest,
    OrderResponse,
    PlanItem,
    UserQuotaResponse,
)
from services.billing import create_order, get_quota_info, list_plans, mark_order_paid

router = APIRouter(tags=["billing"])


def order_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        plan=order.plan,
        price=order.price,
        baseQuota=order.base_quota,
        bonusQuota=order.bonus_quota,
        totalQuota=order.total_quota,
        orderType=order.order_type,
        paymentStatus=order.payment_status,
        createdAt=order.created_at,
        paidAt=order.paid_at,
    )


def verify_payment_signature(payload: OrderPaymentCallbackRequest) -> None:
    if not PAYMENT_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="支付回调密钥未配置")
    if not payload.timestamp or not payload.signature:
        raise HTTPException(status_code=401, detail="支付回调签名缺失")
    if abs(int(time.time()) - payload.timestamp) > PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
        raise HTTPException(status_code=401, detail="支付回调已过期")

    signed_payload = f"{payload.orderId}.{payload.paymentStatus}.{payload.timestamp}"
    expected = hmac.digest(
        PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
        signed_payload.encode("utf-8"),
        "sha256",
    ).hex()
    if not hmac.compare_digest(expected, payload.signature):
        raise HTTPException(status_code=401, detail="支付回调签名无效")


@router.get("/api/user/quota", response_model=UserQuotaResponse)
async def get_user_quota(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return UserQuotaResponse(**await get_quota_info(db, user, include_logs=True))


@router.post("/api/user/promo-popup-shown", response_model=MessageResponse)
async def mark_promo_popup_shown(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.promo_popup_shown = True
    await db.commit()
    return MessageResponse(message="优惠弹窗状态已更新")


@router.get("/api/plans", response_model=list[PlanItem])
async def get_plans():
    return [PlanItem(**plan) for plan in list_plans()]


@router.post("/api/orders/create", response_model=OrderResponse)
async def create_user_order(
    payload: OrderCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order = await create_order(db, user, payload.plan, payload.orderType)
        await db.commit()
        await db.refresh(order)
        return order_response(order)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/orders/payment-callback", response_model=OrderResponse)
async def payment_callback(
    payload: OrderPaymentCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    verify_payment_signature(payload)

    order = await db.get(Order, payload.orderId)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if payload.paymentStatus != "paid":
        if order.payment_status == "pending":
            order.payment_status = payload.paymentStatus
        await db.commit()
        await db.refresh(order)
        return order_response(order)

    user = await db.get(User, order.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    try:
        order = await mark_order_paid(db, user, payload.orderId)
        await db.commit()
        await db.refresh(order)
        return order_response(order)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
