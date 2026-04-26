from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import User
from models.schemas import UserCreate, UserLogin, TokenResponse, UserInfo, UserProfileResponse, QuotaInfo
from core.security import get_password_hash, verify_password, create_access_token, get_current_user
from core.database import get_db
from services.billing import get_quota_info

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
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

    token = create_access_token({"sub": user.email})
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            plan=user.plan,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_access_token({"sub": user.email})
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            plan=user.plan,
        ),
    )


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
