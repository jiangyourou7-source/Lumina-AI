import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import PasswordResetToken, User
from models.schemas import (
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
from core.security import get_current_session_token, get_current_user, get_password_hash, verify_password
from core.config import PASSWORD_RESET_BASE_URL, PASSWORD_RESET_EXPIRE_MINUTES
from core.database import get_db
from services.billing import get_quota_info
from services.email_service import send_password_reset_email
from services.session_service import create_user_session, revoke_user_session

router = APIRouter(prefix="/api/auth", tags=["auth"])
PASSWORD_RESET_SENT_MESSAGE = "如果该邮箱已注册，重置邮件已发送"


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


@router.post("/register", response_model=SessionAuthResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已注册")

    hashed = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed,
        name=user_data.name or user_data.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    session_token = await create_user_session(db, user)
    return SessionAuthResponse(
        session_token=session_token,
        user=UserInfo(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            plan=user.plan,
        ),
    )


@router.post("/login", response_model=SessionAuthResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    session_token = await create_user_session(db, user)
    return SessionAuthResponse(
        session_token=session_token,
        user=UserInfo(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            plan=user.plan,
        ),
    )


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
    return UserProfileResponse(
        user=UserInfo(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            plan=user.plan,
        ),
        quota=QuotaInfo(**quota_info),
    )
