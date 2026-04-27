from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    user: "UserInfo"


class SessionAuthResponse(AuthResponse):
    session_token: str


class UserInfo(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    plan: str = "free"

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    user: UserInfo
    quota: "QuotaInfo"


class QuotaInfo(BaseModel):
    total: int
    used: int
    remaining: int
    plan: str


ImageSize = Literal[
    "auto",
    "1024x1024",
    "1536x1024",
    "1024x1536",
    "1:1",
    "3:2",
    "2:3",
    "4:3",
    "3:4",
    "5:4",
    "4:5",
    "16:9",
    "9:16",
    "2:1",
    "1:2",
    "21:9",
    "9:21",
]

ImageResolution = Literal["1k", "2k", "4k"]


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    size: ImageSize = "1024x1024"
    resolution: ImageResolution = "1k"
    quality: Literal["standard", "low", "medium", "high", "auto"] = "high"
    model: Optional[str] = Field(default=None, max_length=80)


class GenerateResponse(BaseModel):
    url: str
    remaining_quota: int


class EditRequest(BaseModel):
    image_url: str = Field(min_length=1, max_length=15_000_000)
    prompt: str = Field(min_length=1, max_length=4000)
    size: ImageSize = "1024x1024"
    resolution: ImageResolution = "1k"
    quality: Literal["standard", "low", "medium", "high", "auto"] = "high"
    model: Optional[str] = Field(default=None, max_length=80)


class EditResponse(BaseModel):
    url: str
    remaining_quota: int


class GalleryItemCreate(BaseModel):
    url: str = Field(min_length=1, max_length=1_000_000)
    title: Optional[str] = Field(default="未命名作品", max_length=200)
    prompt: Optional[str] = Field(default=None, max_length=4000)
    category: Optional[str] = Field(default="其他", max_length=50)
    size: Optional[str] = Field(default="1024x1024", max_length=20)
    quality: Optional[str] = Field(default="high", max_length=20)
    source: Optional[str] = Field(default="generate", max_length=20)


class GalleryItemResponse(BaseModel):
    id: int
    url: str
    title: str
    prompt: Optional[str] = None
    category: str
    size: str
    quality: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class GalleryListResponse(BaseModel):
    items: list[GalleryItemResponse]
    total: int


class CanvasSaveRequest(BaseModel):
    title: Optional[str] = Field(default="未命名画布", max_length=200)
    canvas_data: dict
    thumbnail: Optional[str] = Field(default=None, max_length=2_000_000)


class CanvasUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    canvas_data: Optional[dict] = None
    thumbnail: Optional[str] = Field(default=None, max_length=2_000_000)


class CanvasResponse(BaseModel):
    id: int
    title: str
    canvas_data: dict
    thumbnail: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CanvasListResponse(BaseModel):
    items: list[CanvasResponse]
    total: int


class MessageResponse(BaseModel):
    message: str
