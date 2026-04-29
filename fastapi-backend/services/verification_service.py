import base64
import hashlib
import html
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import EMAIL_CODE_DEV_MODE, SESSION_TOKEN_BYTES
from models.database import CaptchaChallenge, EmailVerificationCode
from services.email_service import send_email_verification_code

CAPTCHA_EXPIRE_SECONDS = 300
EMAIL_CODE_EXPIRE_SECONDS = 300
EMAIL_RESEND_SECONDS = 60
EMAIL_DAILY_LIMIT = 10
IP_DAILY_LIMIT = 40
MAX_VERIFY_ATTEMPTS = 5


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:80]
    return (request.client.host if request.client else "unknown")[:80]


def hash_code(kind: str, code_id: str, code: str) -> str:
    salt = f"{kind}:{code_id}:{SESSION_TOKEN_BYTES}"
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def build_captcha_svg(code: str) -> str:
    digits = "".join(
        f'<text x="{34 + index * 28}" y="{46 + (index % 2) * 5}" '
        f'font-size="28" font-weight="700" fill="#0f172a" '
        f'transform="rotate({[-8, 4, -3, 7][index]} {34 + index * 28} 42)">'
        f"{html.escape(digit)}</text>"
        for index, digit in enumerate(code)
    )
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="64" viewBox="0 0 160 64">
      <rect width="160" height="64" rx="14" fill="#eff6ff"/>
      <path d="M10 45 C40 20, 70 54, 100 26 S140 42, 152 20" stroke="#93c5fd" stroke-width="3" fill="none"/>
      <path d="M14 18 H146 M18 52 H140" stroke="#bfdbfe" stroke-width="2" stroke-dasharray="6 7"/>
      {digits}
    </svg>
    """
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


async def create_captcha(db: AsyncSession, request: Request) -> tuple[str, str]:
    code = f"{secrets.randbelow(10000):04d}"
    captcha_id = secrets.token_urlsafe(24)
    db.add(
        CaptchaChallenge(
            id=captcha_id,
            code_hash=hash_code("captcha", captcha_id, code),
            ip_address=client_ip(request),
            expires_at=utcnow() + timedelta(seconds=CAPTCHA_EXPIRE_SECONDS),
        )
    )
    await db.commit()
    return captcha_id, build_captcha_svg(code)


async def verify_captcha(db: AsyncSession, captcha_id: str, code: str, *, consume: bool = True) -> None:
    result = await db.execute(select(CaptchaChallenge).where(CaptchaChallenge.id == captcha_id))
    challenge = result.scalar_one_or_none()
    if (
        not challenge
        or challenge.used_at
        or as_aware(challenge.expires_at) < utcnow()
        or challenge.attempts >= MAX_VERIFY_ATTEMPTS
    ):
        raise HTTPException(status_code=400, detail="验证码错误，请重新输入。")

    challenge.attempts += 1
    if challenge.code_hash != hash_code("captcha", captcha_id, code):
        await db.commit()
        raise HTTPException(status_code=400, detail="验证码错误，请重新输入。")

    if consume:
        challenge.used_at = utcnow()
    await db.commit()


async def send_email_code(db: AsyncSession, request: Request, email: str, scene: str) -> str | None:
    normalized_email = email.strip().lower()
    now = utcnow()
    ip = client_ip(request)

    latest_result = await db.execute(
        select(EmailVerificationCode)
        .where(EmailVerificationCode.email == normalized_email, EmailVerificationCode.scene == scene)
        .order_by(desc(EmailVerificationCode.created_at))
        .limit(1)
    )
    latest = latest_result.scalar_one_or_none()
    if latest and (now - as_aware(latest.created_at)).total_seconds() < EMAIL_RESEND_SECONDS:
        raise HTTPException(status_code=429, detail="验证码发送太频繁，请稍后再试。")

    day_start = now - timedelta(hours=24)
    email_count = (
        await db.execute(
            select(func.count())
            .select_from(EmailVerificationCode)
            .where(
                EmailVerificationCode.email == normalized_email,
                EmailVerificationCode.scene == scene,
                EmailVerificationCode.created_at >= day_start,
            )
        )
    ).scalar_one()
    if email_count >= EMAIL_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="该邮箱今日验证码发送次数已达上限。")

    ip_count = (
        await db.execute(
            select(func.count())
            .select_from(EmailVerificationCode)
            .where(EmailVerificationCode.ip_address == ip, EmailVerificationCode.created_at >= day_start)
        )
    ).scalar_one()
    if ip_count >= IP_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="当前网络请求过于频繁，请稍后再试。")

    code = f"{secrets.randbelow(1000000):06d}"
    sent = await send_email_verification_code(normalized_email, code, scene)
    if not sent:
        if not EMAIL_CODE_DEV_MODE:
            raise HTTPException(status_code=503, detail="邮件服务未配置或发送失败，请稍后再试。")

    db.add(
        EmailVerificationCode(
            email=normalized_email,
            scene=scene,
            code_hash=hash_code("email", f"{normalized_email}:{scene}", code),
            ip_address=ip,
            expires_at=now + timedelta(seconds=EMAIL_CODE_EXPIRE_SECONDS),
        )
    )
    await db.commit()
    return code if EMAIL_CODE_DEV_MODE and not sent else None


async def verify_email_code(db: AsyncSession, email: str, scene: str, code: str, *, consume: bool = True) -> None:
    normalized_email = email.strip().lower()
    result = await db.execute(
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == normalized_email,
            EmailVerificationCode.scene == scene,
            EmailVerificationCode.used_at.is_(None),
        )
        .order_by(desc(EmailVerificationCode.created_at))
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if not record or as_aware(record.expires_at) < utcnow() or record.attempts >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=400, detail="邮箱验证码错误或已过期。")

    record.attempts += 1
    if record.code_hash != hash_code("email", f"{normalized_email}:{scene}", code):
        await db.commit()
        raise HTTPException(status_code=400, detail="邮箱验证码错误或已过期。")

    if consume:
        record.used_at = utcnow()
    await db.commit()
