import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import SESSION_TOKEN_BYTES, SESSION_TTL_DAYS
from models.database import User, UserSession


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_user_session(db: AsyncSession, user: User) -> str:
    token = secrets.token_urlsafe(SESSION_TOKEN_BYTES)
    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(token),
        expires_at=utcnow() + timedelta(days=SESSION_TTL_DAYS),
        last_used_at=utcnow(),
    )
    db.add(session)
    await db.commit()
    return token


async def get_user_session(db: AsyncSession, token: str) -> UserSession | None:
    result = await db.execute(
        select(UserSession)
        .options(selectinload(UserSession.user))
        .where(UserSession.token_hash == hash_session_token(token))
    )
    session = result.scalar_one_or_none()
    if session is None:
        return None

    if as_aware(session.expires_at) <= utcnow():
        await db.delete(session)
        await db.commit()
        return None

    return session


async def revoke_user_session(db: AsyncSession, token: str) -> bool:
    result = await db.execute(
        select(UserSession).where(UserSession.token_hash == hash_session_token(token))
    )
    session = result.scalar_one_or_none()
    if session is None:
        return False

    await db.delete(session)
    await db.commit()
    return True
