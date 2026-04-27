# Deploy Drmina AI to Alibaba Cloud ECS

This guide is for the current MVP on one Alibaba Cloud Hong Kong ECS without a domain.

Public URL for the first deployment:

```text
http://47.76.44.89
```

## 1. Security Group

Open these inbound TCP ports in Alibaba Cloud:

```text
22   SSH / Workbench
80   HTTP
```

Open `443` later when you bind a domain and enable HTTPS.

Do not expose `3000` or `8000`; Docker and Nginx keep them internal.

## 2. Install Server Dependencies

Run these commands on the ECS:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker admin
```

Reconnect to the terminal, then verify:

```bash
docker --version
docker compose version
```

If `docker` is still permission denied, use `sudo docker` and `sudo docker compose` for this session.

## 3. Clone Project

```bash
sudo mkdir -p /opt/drmine-ai
sudo chown -R admin:admin /opt/drmine-ai
cd /opt/drmine-ai
git clone https://github.com/jiangyourou7-source/Lumina-AI.git .
```

## 4. Create Production Env Files

```bash
cp deploy/env.backend.example fastapi-backend/.env.production
cp deploy/env.frontend.example lumina-ai/.env.production
nano fastapi-backend/.env.production
nano lumina-ai/.env.production
```

Minimum changes:

- Set `OPENAI_API_KEY` in `fastapi-backend/.env.production`.
- Keep `DATABASE_URL=sqlite+aiosqlite:////data/drmine.db` for the first ECS deployment.
- Keep `SESSION_COOKIE_SECURE=false` while using plain HTTP by IP.

If you use Supabase templates, set `NEXT_PUBLIC_SUPABASE_URL` in `lumina-ai/.env.production`.

## 5. Start App

```bash
cd /opt/drmine-ai
docker compose -f docker-compose.prod.yml up -d --build
```

Check services:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=80
```

Health check:

```bash
curl http://127.0.0.1/health
```

Open:

```text
http://47.76.44.89
```

## 6. Update Deployment

```bash
cd /opt/drmine-ai
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 7. Later: Domain and HTTPS

After the domain A record points to `47.76.44.89`:

1. Change `PASSWORD_RESET_BASE_URL` and `CORS_ORIGINS` to `https://your-domain`.
2. Change `SESSION_COOKIE_SECURE=true`.
3. Replace `deploy/nginx-ip.conf` with a domain HTTPS Nginx config or put a host-level Nginx/Certbot in front.
4. Rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
