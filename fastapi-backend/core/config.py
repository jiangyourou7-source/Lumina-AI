import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("MIDTRANS_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL") or os.getenv("MIDTRANS_BASE_URL", "https://api.openai.com/v1")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
MIDTRANS_API_KEY = os.getenv("MIDTRANS_API_KEY", "")
MIDTRANS_BASE_URL = os.getenv("MIDTRANS_BASE_URL", "https://api.dmxapi.com/v1")
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))
SESSION_TOKEN_BYTES = int(os.getenv("SESSION_TOKEN_BYTES", "32"))
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Drmina AI <onboarding@resend.dev>")
PASSWORD_RESET_BASE_URL = os.getenv("PASSWORD_RESET_BASE_URL", "http://localhost:3001")
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./lumina.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
FREE_MONTHLY_QUOTA = int(os.getenv("FREE_MONTHLY_QUOTA", "5"))
PRO_MONTHLY_QUOTA = int(os.getenv("PRO_MONTHLY_QUOTA", "500"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
ADMIN_PHONE = os.getenv("ADMIN_PHONE", "").strip()
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID", "").strip()
VIP1_IMAGE_QUOTA = int(os.getenv("VIP1_IMAGE_QUOTA", "50"))
VIP2_IMAGE_QUOTA = int(os.getenv("VIP2_IMAGE_QUOTA", "100"))
VIP3_IMAGE_QUOTA = int(os.getenv("VIP3_IMAGE_QUOTA", "500"))
VIP1_PRICE = float(os.getenv("VIP1_PRICE", "9.9"))
VIP2_PRICE = float(os.getenv("VIP2_PRICE", "19.9"))
VIP3_PRICE = float(os.getenv("VIP3_PRICE", "99.9"))
PROMO_VIP2_BONUS_QUOTA = int(os.getenv("PROMO_VIP2_BONUS_QUOTA", "50"))
PAYMENT_WEBHOOK_SECRET = os.getenv("PAYMENT_WEBHOOK_SECRET", "").strip()
PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = int(
    os.getenv("PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS", "300")
)
