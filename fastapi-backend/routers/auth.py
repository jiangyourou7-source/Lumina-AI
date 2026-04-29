import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PASSWORD_RESET_BASE_URL, PASSWORD_RESET_EXPIRE_MINUTES
from core.database import get_db
from core.security import (
    get_current_session_token,
    get_current_user,
    get_password_hash,
    is_admin_user,
    verify_password,
)
from models.database import LoginAttempt, PasswordResetToken, User
from models.schemas import (
    CaptchaResponse,
    EmailCodeRequest,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    QuotaInfo,
    SessionAuthResponse,
    UserCreate,
    UserInfo,
    UserLogin,
    UserProfileResponse,
)
from services.billing import FREE_MONTHLY_QUOTA, get_quota_info, legacy_quota_info, normalize_plan
from services.email_service import send_password_reset_email
from services.session_service import create_user_session, revoke_user_session
from services.verification_service import (
    CAPTCHA_EXPIRE_SECONDS,
    client_ip,
    create_captcha,
    send_email_code,
    verify_captcha,
    verify_email_code,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
PASSWORD_RESET_SENT_MESSAGE = "如果该邮箱已注册，重置邮件已发送。"
EMAIL_CODE_SENT_MESSAGE = "如果邮箱格式正确，验证码已发送。"
LOGIN_FAILURE_WINDOW_MINUTES = 15
LOGIN_EMAIL_FAILURE_LIMIT = 5
LOGIN_IP_FAILURE_LIMIT = 20


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


async def enforce_login_rate_limit(db: AsyncSession, email: str, ip_address: str) -> None:
    since = utcnow() - timedelta(minutes=LOGIN_FAILURE_WINDOW_MINUTES)
    normalized_email = email.strip().lower()
    email_failures = (
        await db.execute(
            select(func.count())
            .select_from(LoginAttempt)
            .where(
                LoginAttempt.email == normalized_email,
                LoginAttempt.success.is_(False),
                LoginAttempt.created_at >= since,
            )
        )
    ).scalar_one()
    if email_failures >= LOGIN_EMAIL_FAILURE_LIMIT:
        raise HTTPException(status_code=429, detail="登录失败次数过多，请稍后再试")

    ip_failures = (
        await db.execute(
            select(func.count())
            .select_from(LoginAttempt)
            .where(
                LoginAttempt.ip_address == ip_address,
                LoginAttempt.success.is_(False),
                LoginAttempt.created_at >= since,
            )
        )
    ).scalar_one()
    if ip_failures >= LOGIN_IP_FAILURE_LIMIT:
        raise HTTPException(status_code=429, detail="当前网络登录失败次数过多，请稍后再试")


async def record_login_attempt(db: AsyncSession, email: str, ip_address: str, success: bool) -> None:
    db.add(
        LoginAttempt(
            email=email.strip().lower(),
            ip_address=ip_address,
            success=success,
        )
    )
    await db.commit()


def user_info(user: User) -> UserInfo:
    return UserInfo(
        id=user.id,
        email=user.email,
        phone=getattr(user, "phone", None),
        name=user.name,
        avatar=user.avatar,
        plan=normalize_plan(user),
        role="admin" if is_admin_user(user) else getattr(user, "role", "user"),
        vip_level=getattr(user, "vip_level", "normal"),
        status=getattr(user, "status", "active"),
    )


@router.post("/register", response_model=SessionAuthResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    await verify_captcha(db, user_data.captchaId, user_data.captchaCode)

    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已注册")

    hashed = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed,
        name=user_data.name or user_data.email.split("@")[0],
        plan="free",
        vip_level="normal",
        image_quota_total=FREE_MONTHLY_QUOTA,
        image_quota_used=0,
        image_quota_remaining=FREE_MONTHLY_QUOTA,
        free_generation_count=0,
        promo_popup_shown=False,
        promo_vip2_used=False,
        status="active",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    if is_admin_user(user):
        user.role = "admin"
    user.last_login_at = utcnow()
    await db.commit()
    await db.refresh(user)

    session_token = await create_user_session(db, user)
    return SessionAuthResponse(session_token=session_token, user=user_info(user))


@router.post("/login", response_model=SessionAuthResponse)
async def login(user_data: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    await verify_captcha(db, user_data.captchaId, user_data.captchaCode)
    ip_address = client_ip(request)
    await enforce_login_rate_limit(db, user_data.email, ip_address)

    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(user_data.password, user.hashed_password):
        await record_login_attempt(db, user_data.email, ip_address, False)
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if getattr(user, "status", "active") == "disabled":
        raise HTTPException(status_code=403, detail="账号已被禁用，请联系管理员。")

    if is_admin_user(user):
        user.role = "admin"
    user.last_login_at = utcnow()
    await db.commit()
    await db.refresh(user)

    await record_login_attempt(db, user.email, ip_address, True)
    session_token = await create_user_session(db, user)
    return SessionAuthResponse(session_token=session_token, user=user_info(user))


@router.get("/captcha", response_model=CaptchaResponse)
async def captcha(request: Request, db: AsyncSession = Depends(get_db)):
    captcha_id, captcha_image = await create_captcha(db, request)
    return CaptchaResponse(
        captchaId=captcha_id,
        captchaImage=captcha_image,
        expiresIn=CAPTCHA_EXPIRE_SECONDS,
    )


@router.post("/send-email-code", response_model=MessageResponse)
async def send_auth_email_code(
    payload: EmailCodeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    dev_code = await send_email_code(db, request, payload.email, payload.scene)
    message = EMAIL_CODE_SENT_MESSAGE
    if dev_code:
        message = f"{message} 本地开发验证码：{dev_code}"
    return MessageResponse(message=message)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    token: str = Depends(get_current_session_token),
    db: AsyncSession = Depends(get_db),
):
    await revoke_user_session(db, token)
    return MessageResponse(message="已退出登录")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        return MessageResponse(message=PASSWORD_RESET_SENT_MESSAGE)

    token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(token)
    expires_at = utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    reset_link = f"{PASSWORD_RESET_BASE_URL.rstrip('/')}/reset-password?token={token}"

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    await db.commit()
    await send_password_reset_email(user.email, reset_link)
    return MessageResponse(message=PASSWORD_RESET_SENT_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    if payload.email and payload.emailCode:
        await verify_email_code(db, payload.email, "reset_password", payload.emailCode)
        result = await db.execute(select(User).where(User.email == payload.email))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=400, detail="邮箱验证码错误或已过期。")
        user.hashed_password = get_password_hash(payload.new_password)
        await db.commit()
        return MessageResponse(message="密码已更新，请使用新密码登录")

    if not payload.token:
        raise HTTPException(status_code=400, detail="重置链接无效或已过期")

    token_hash = hash_reset_token(payload.token)
    result = await db.execute(
        select(PasswordResetToken, User)
        .join(User, PasswordResetToken.user_id == User.id)
        .where(PasswordResetToken.token_hash == token_hash)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=400, detail="重置链接无效或已过期")

    reset_token, user = row
    if reset_token.used_at or as_aware(reset_token.expires_at) < utcnow():
        raise HTTPException(status_code=400, detail="重置链接无效或已过期")

    user.hashed_password = get_password_hash(payload.new_password)
    reset_token.used_at = utcnow()
    await db.commit()
    return MessageResponse(message="密码已更新，请使用新密码登录")


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    quota_info = await get_quota_info(db, user)
    return UserProfileResponse(user=user_info(user), quota=QuotaInfo(**legacy_quota_info(quota_info)))
