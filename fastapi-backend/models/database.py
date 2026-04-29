from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Float, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=True)
    avatar = Column(String(500), nullable=True)
    role = Column(String(20), default="user", nullable=False)
    plan = Column(String(20), default="free")
    vip_level = Column(String(20), default="normal", nullable=False)
    image_quota_total = Column(Integer, default=5, nullable=False)
    image_quota_used = Column(Integer, default=0, nullable=False)
    image_quota_remaining = Column(Integer, default=5, nullable=False)
    free_generation_count = Column(Integer, default=0, nullable=False)
    promo_popup_shown = Column(Boolean, default=False, nullable=False)
    promo_vip2_used = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="active", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    canvases = relationship("Canvas", back_populates="user", cascade="all, delete-orphan")
    gallery_items = relationship("GalleryItem", back_populates="user", cascade="all, delete-orphan")
    quota = relationship("Quota", back_populates="user", uselist=False, cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    generation_logs = relationship("ImageGenerationLog", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")


class Canvas(Base):
    __tablename__ = "canvases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), default="未命名画布")
    canvas_data = Column(JSON, nullable=False)
    thumbnail = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="canvases")


class GalleryItem(Base):
    __tablename__ = "gallery_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    url = Column(String(1000), nullable=False)
    title = Column(String(200), default="未命名作品")
    prompt = Column(Text, nullable=True)
    category = Column(String(50), default="其他")
    size = Column(String(20), default="1024x1024")
    quality = Column(String(20), default="high")
    source = Column(String(20), default="generate")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="gallery_items")


class Quota(Base):
    __tablename__ = "quotas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    total_quota = Column(Integer, default=5)
    used_quota = Column(Integer, default=0)
    period_start = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    period_end = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="quota")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="password_reset_tokens")


class CaptchaChallenge(Base):
    __tablename__ = "captcha_challenges"

    id = Column(String(64), primary_key=True)
    code_hash = Column(String(128), nullable=False)
    ip_address = Column(String(80), nullable=True, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), index=True, nullable=False)
    scene = Column(String(40), index=True, nullable=False)
    code_hash = Column(String(128), nullable=False)
    ip_address = Column(String(80), nullable=True, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), index=True, nullable=False)
    ip_address = Column(String(80), nullable=True, index=True)
    success = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_used_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="sessions")


class ImageGenerationLog(Base):
    __tablename__ = "image_generation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    prompt = Column(Text, nullable=True)
    aspect_ratio = Column(String(50), nullable=True)
    quality = Column(String(50), nullable=True)
    image_count = Column(Integer, default=1, nullable=False)
    success_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="success", nullable=False)
    quota_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="generation_logs")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan = Column(String(20), nullable=False)
    price = Column(Float, nullable=False)
    base_quota = Column(Integer, nullable=False)
    bonus_quota = Column(Integer, default=0, nullable=False)
    total_quota = Column(Integer, nullable=False)
    order_type = Column(String(20), default="normal", nullable=False)
    payment_status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    paid_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="orders")


class AdminActionLog(Base):
    __tablename__ = "admin_action_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    before_value = Column(Text, nullable=True)
    after_value = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
