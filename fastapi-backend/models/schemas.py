from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = Field(default=None, max_length=100)
    captchaId: str = Field(min_length=10, max_length=80)
    captchaCode: str = Field(pattern=r"^\d{4,6}$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    captchaId: str = Field(min_length=10, max_length=80)
    captchaCode: str = Field(pattern=r"^\d{4,6}$")


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: Optional[str] = Field(default=None, min_length=20, max_length=256)
    email: Optional[EmailStr] = None
    emailCode: Optional[str] = Field(default=None, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


class CaptchaResponse(BaseModel):
    captchaId: str
    captchaImage: str
    expiresIn: int


class EmailCodeRequest(BaseModel):
    email: EmailStr
    scene: Literal["register", "reset_password"]


class AuthResponse(BaseModel):
    user: "UserInfo"


class SessionAuthResponse(AuthResponse):
    session_token: str


class UserInfo(BaseModel):
    id: int
    email: str
    phone: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None
    plan: str = "free"
    role: str = "user"
    vip_level: str = "normal"
    status: str = "active"

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


class GenerationLogItem(BaseModel):
    id: int
    createdAt: datetime
    imageCount: int
    successCount: int
    failedCount: int
    quotaUsed: int
    status: str


class UserQuotaResponse(BaseModel):
    plan: str
    planLabel: str
    imageQuotaTotal: int
    imageQuotaUsed: int
    imageQuotaRemaining: int
    freeGenerationCount: int
    promoPopupShown: bool
    promoVip2Used: bool
    recentGenerationLogs: list[GenerationLogItem] = []


class PlanItem(BaseModel):
    plan: Literal["vip1", "vip2", "vip3"]
    name: str
    price: float
    quota: int


class OrderCreateRequest(BaseModel):
    plan: Literal["vip1", "vip2", "vip3"]
    orderType: Literal["normal", "promo_vip2"] = "normal"


class OrderPaymentCallbackRequest(BaseModel):
    orderId: int
    paymentStatus: Literal["paid", "failed", "cancelled"] = "paid"
    timestamp: Optional[int] = None
    signature: Optional[str] = Field(default=None, max_length=256)


class OrderResponse(BaseModel):
    id: int
    plan: str
    price: float
    baseQuota: int
    bonusQuota: int
    totalQuota: int
    orderType: str
    paymentStatus: str
    createdAt: datetime
    paidAt: Optional[datetime] = None


class AdminStatsResponse(BaseModel):
    totalUsers: int
    todayNewUsers: int
    last7DaysNewUsers: int
    last30DaysNewUsers: int
    totalAccounts: int
    activeAccounts: int
    disabledAccounts: int
    vipAccounts: int
    totalImageGenerations: int
    todayImageGenerations: int
    last7DaysImageGenerations: int
    last30DaysImageGenerations: int
    registrationTrend: list[dict]
    generationTrend: list[dict]


class AdminUserItem(BaseModel):
    id: int
    email: str
    phone: Optional[str] = None
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    role: str
    vip_level: str
    image_quota_total: int
    image_quota_used: int
    image_quota_remaining: int
    status: str
    created_at: datetime
    last_login_at: Optional[datetime] = None


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    pageSize: int


class AdminVipLevelUpdate(BaseModel):
    vipLevel: Literal["vip1", "vip2", "vip3"]


class AdminGenerationLogItem(BaseModel):
    id: int
    user_id: int
    prompt: Optional[str] = None
    aspect_ratio: Optional[str] = None
    quality: Optional[str] = None
    image_count: int
    success_count: int = 0
    failed_count: int = 0
    status: str
    quota_used: int
    created_at: datetime


class AdminGenerationLogsResponse(BaseModel):
    items: list[AdminGenerationLogItem]
    total: int


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
    shouldShowPromoPopup: bool = False


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


PortraitReferenceRole = Literal[
    "person",
    "top",
    "pants",
    "shoes",
    "accessory",
    "background",
    "style",
    "other",
]


class PortraitReference(BaseModel):
    role: PortraitReferenceRole = "other"
    image_url: str = Field(min_length=1, max_length=15_000_000)
    label: Optional[str] = Field(default=None, max_length=80)
    layer_id: Optional[str] = Field(default=None, max_length=120)


class PortraitComposeRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    references: list[PortraitReference] = Field(min_length=1, max_length=12)
    size: ImageSize = "1024x1024"
    resolution: ImageResolution = "1k"
    quality: Literal["standard", "low", "medium", "high", "auto"] = "high"
    model: Optional[str] = Field(default=None, max_length=80)


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
