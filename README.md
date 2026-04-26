# Lumina AI

Lumina AI is an AI image generation and canvas editing MVP for small business marketing visuals, ecommerce assets, and polished social posts.

Current capabilities:

- Email and password registration/login
- APIMart `gpt-image-2` text-to-image and reference-image editing
- 1k / 2k / 4k resolution options
- Account-based gallery
- Canvas editor MVP
- FastAPI backend and Next.js frontend

## Project Structure

```text
.
+-- fastapi-backend/   # FastAPI API, auth, image generation, gallery, canvas data
+-- lumina-ai/         # Next.js frontend
+-- render.yaml        # Render backend deployment blueprint
`-- README.md
```

## Local Development

### Backend

```bash
cd fastapi-backend
copy .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

### Frontend

```bash
cd lumina-ai
copy .env.example .env.local
npm install
npm run dev -- -p 3001
```

Open:

```text
http://127.0.0.1:3001
```

## Environment Variables

Backend:

```env
OPENAI_API_KEY=your_apimart_api_key
OPENAI_BASE_URL=https://api.apimart.ai/v1
OPENAI_IMAGE_MODEL=gpt-image-2
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=sqlite+aiosqlite:///./lumina.db
CORS_ORIGINS=http://localhost:3001
```

Frontend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Do not commit real `.env`, `.env.local`, API keys, or database passwords.

## Deployment

Recommended MVP stack:

- Frontend: Vercel
- Backend: Render
- Database: Supabase PostgreSQL
- Email service: not connected yet; current MVP uses email + password login only

### Supabase PostgreSQL

Create a Supabase project and copy its PostgreSQL connection string. Configure it in Render:

```env
DATABASE_URL=postgresql+asyncpg://postgres.your-project:your-password@aws-0-region.pooler.supabase.com:6543/postgres
```

If Supabase gives you a `postgresql://...` URL, the backend automatically converts it to SQLAlchemy's asyncpg URL format.

### Render Backend

Use the root `render.yaml` blueprint, or create a web service manually.

Render environment variables:

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

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Vercel Frontend

Vercel settings:

```text
Root Directory: lumina-ai
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
```

Vercel environment variable:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-api.onrender.com
```

After deployment, add the Vercel domain to Render:

```env
CORS_ORIGINS=https://your-vercel-domain.vercel.app
```

## Release Checklist

- Register a new account
- Log in
- Generate a `gpt-image-2` image
- Test 1k / 2k / 4k options
- Save generated images to the gallery
- Save and restore canvas data
- Clear `lumina_token` and confirm protected pages redirect to login
- Confirm `/health` returns `{"status":"healthy"}`

## Production Follow-Ups

- Email verification or magic link
- Forgot password and reset password
- Database migrations with Alembic
- Rate limiting for generation endpoints
- Store generated images in owned object storage
- Plans, billing, and payment system
