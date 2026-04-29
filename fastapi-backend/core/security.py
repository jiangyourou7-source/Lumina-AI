import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import ADMIN_EMAIL, ADMIN_PHONE, ADMIN_USER_ID
from core.database import get_db
from models.database import User, UserSession
from services.session_service import get_user_session

security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def get_current_session_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


async def get_current_session(
    token: str = Depends(get_current_session_token),
    db: AsyncSession = Depends(get_db),
) -> UserSession:
    session = await get_user_session(db, token)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录状态已失效，请重新登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return session


async def get_current_user(
    session: UserSession = Depends(get_current_session),
) -> User:
    if session.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    if getattr(session.user, "status", "active") == "disabled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用，请联系管理员。",
        )
    return session.user


def is_admin_user(user: User) -> bool:
    if getattr(user, "role", "user") == "admin":
        return True
    if ADMIN_USER_ID and str(user.id) == ADMIN_USER_ID:
        return True
    if ADMIN_EMAIL and (user.email or "").lower() == ADMIN_EMAIL:
        return True
    if ADMIN_PHONE and getattr(user, "phone", None) == ADMIN_PHONE:
        return True
    return False


async def get_current_admin_user(user: User = Depends(get_current_user)) -> User:
    if not is_admin_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限访问",
        )
    return user
