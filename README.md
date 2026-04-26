# Lumina AI

Lumina AI 是面向中小企业和朋友圈精修场景的 AI 出图与画布编辑 MVP。

当前能力：

- 邮箱 + 密码注册登录
- APIMart `gpt-image-2` 文生图 / 参考图编辑
- 1k / 2k / 4k 分辨率档位
- 作品库与用户账号绑定
- 画布编辑 MVP
- FastAPI 后端 + Next.js 前端

## 项目结构

```text
.
├── fastapi-backend/   # FastAPI API、鉴权、出图、作品库、画布数据
├── lumina-ai/         # Next.js 前端
├── render.yaml        # Render 后端部署蓝图
└── README.md
```

## 本地开发

### 1. 后端

```bash
cd fastapi-backend
copy .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

后端健康检查：

```bash
curl http://127.0.0.1:8000/health
```

### 2. 前端

```bash
cd lumina-ai
copy .env.example .env.local
npm install
npm run dev -- -p 3001
```

访问：

```text
http://127.0.0.1:3001
```

## 环境变量

后端必填：

```env
OPENAI_API_KEY=your_apimart_api_key
OPENAI_BASE_URL=https://api.apimart.ai/v1
OPENAI_IMAGE_MODEL=gpt-image-2
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=sqlite+aiosqlite:///./lumina.db
CORS_ORIGINS=http://localhost:3001
```

前端必填：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

不要把真实 `.env`、`.env.local`、API Key、数据库密码提交到 GitHub。

## 部署方案

推荐 MVP 部署：

- 前端：Vercel
- 后端：Render
- 数据库：Supabase PostgreSQL
- 邮箱服务：暂不接验证码服务，当前使用邮箱 + 密码注册登录

### Supabase PostgreSQL

在 Supabase 创建项目后，复制连接字符串，并在 Render 后端环境变量中配置：

```env
DATABASE_URL=postgresql+asyncpg://postgres.your-project:your-password@aws-0-region.pooler.supabase.com:6543/postgres
```

如果 Supabase 给的是 `postgresql://...`，后端会自动转换为 SQLAlchemy asyncpg 格式。

### Render 后端

可以直接使用根目录的 `render.yaml` 创建服务。

Render 需要配置这些环境变量：

```env
OPENAI_API_KEY=your_apimart_api_key
OPENAI_BASE_URL=https://api.apimart.ai/v1
OPENAI_IMAGE_MODEL=gpt-image-2
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=your_supabase_postgres_url
CORS_ORIGINS=https://your-vercel-domain.vercel.app
ACCESS_TOKEN_EXPIRE_MINUTES=10080
FREE_MONTHLY_QUOTA=20
PRO_MONTHLY_QUOTA=500
```

启动命令：

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Vercel 前端

Vercel 项目设置：

```text
Root Directory: lumina-ai
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
```

Vercel 环境变量：

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-api.onrender.com
```

部署后，把 Vercel 域名加入 Render 后端：

```env
CORS_ORIGINS=https://your-vercel-domain.vercel.app
```

## 验证清单

上线前至少验证：

- 注册新账号
- 登录
- 生成 `gpt-image-2` 图片
- 选择 1k / 2k / 4k 参数
- 作品保存到作品库
- 画布保存与恢复
- 清空 token 后访问工作台会跳转登录
- `/health` 返回 `{"status":"healthy"}`

## 后续生产化事项

- 邮箱验证码或验证链接
- 忘记密码 / 重置密码
- 生产级数据库迁移工具，例如 Alembic
- 对生成接口增加限流
- 图片资源转存到自有对象存储
- 更完整的用户套餐和支付系统
