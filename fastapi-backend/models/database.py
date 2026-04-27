from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=True)
    avatar = Column(String(500), nullable=True)
    plan = Column(String(20), default="free")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    canvases = relationship("Canvas", back_populates="user", cascade="all, delete-orphan")
    gallery_items = relationship("GalleryItem", back_populates="user", cascade="all, delete-orphan")
    quota = relationship("Quota", back_populates="user", uselist=False, cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


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
    total_quota = Column(Integer, default=10)
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
