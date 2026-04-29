# Drmina AI SQLite Backup

The current MVP stores backend data in the Docker volume `drmine-ai_backend-data`.
Back up the database before server migration, Docker volume changes, or risky deploys.

## Create A Backup

Run on the ECS server from `/opt/drmine-ai`:

```bash
mkdir -p backups
sudo docker run --rm \
  -v drmine-ai_backend-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cp /data/drmine.db /backup/drmine-$(date +%Y%m%d-%H%M%S).db'
ls -lh backups
```

## Restore A Backup

Stop services first, then copy one backup file back into the volume:

```bash
sudo docker compose -f docker-compose.prod.yml down
sudo docker run --rm \
  -v drmine-ai_backend-data:/data \
  -v "$PWD/backups:/backup:ro" \
  alpine sh -c 'cp /backup/YOUR_BACKUP_FILE.db /data/drmine.db'
sudo docker compose -f docker-compose.prod.yml up -d
```

Replace `YOUR_BACKUP_FILE.db` with the actual backup file name.

## Quick Health Check

```bash
curl http://127.0.0.1/health
```
