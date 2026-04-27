import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("MIDTRANS_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL") or os.getenv("MIDTRANS_BASE_URL", "https://api.openai.com/v1")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
MIDTRANS_API_KEY = os.getenv("MIDTRANS_API_KEY", "")
MIDTRANS_BASE_URL = os.getenv("MIDTRANS_BASE_URL", "https://api.dmxapi.com/v1")
SECRET_KEY = os.getenv("SECRET_KEY", "lumina-secret-key-change-in-production-2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Drmine AI <onboarding@resend.dev>")
PASSWORD_RESET_BASE_URL = os.getenv("PASSWORD_RESET_BASE_URL", "http://localhost:3001")
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./lumina.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
FREE_MONTHLY_QUOTA = int(os.getenv("FREE_MONTHLY_QUOTA", "10"))
PRO_MONTHLY_QUOTA = int(os.getenv("PRO_MONTHLY_QUOTA", "500"))
