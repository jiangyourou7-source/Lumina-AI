import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, generate, edit, gallery, canvas
from core.config import CORS_ORIGINS
from core.database import init_db, close_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("正在初始化数据库...")
    await init_db()
    logger.info("数据库初始化完成")
    yield
    logger.info("正在关闭数据库连接...")
    await close_db()
    logger.info("数据库连接已关闭")


app = FastAPI(
    title="Drmina AI API",
    version="1.0",
    description="Drmina AI 智能图像创作平台后端 API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(edit.router)
app.include_router(gallery.router)
app.include_router(canvas.router)


@app.get("/")
async def root():
    return {"message": "Drmina AI API is running", "version": "1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
