# AARX Full Production Deployment Guide

Complete step-by-step guide for deploying the entire AARX platform in production:
Django backend, Celery, AI Service, AARX Mobile App, and Support Web.

---

## 0. Architecture Overview

```
                        ┌─────────────────────┐
                        │     Nginx (443)     │
                        │  SSL Termination    │
                        │  Static + Proxy     │
                        └────────┬────────────┘
                                 │
               ┌─────────────────┼──────────────────┐
               │                 │                  │
    ┌──────────▼──┐     ┌────────▼────────┐  ┌──────▼──────────┐
    │  AARX Mobile │     │  Support Web    │  │   API Clients   │
    │  (Expo)      │     │  (React)        │  │   (external)    │
    └─────────────┘     └────────┬────────┘  └─────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Django ASGI (8000)    │
                    │   Uvicorn Workers       │
                    │   Django + Channels     │
                    └──────┬────────┬─────────┘
                           │        │
            ┌──────────────┘        └──────────────┐
            │                                       │
   ┌────────▼────────┐                    ┌───────▼────────┐
   │ PostgreSQL 5432 │                    │ Redis 6379     │
   │ + PostGIS       │                    │ broker/cache/  │
   │ + PgBouncer 6432│                    │ channels       │
   └─────────────────┘                    └───────┬────────┘
                                                │
                                     ┌──────────▼──────────┐
                                     │ Celery Worker       │
                                     │ Celery Beat         │
                                     └──────────┬──────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │ AI Service (FastAPI)  │
                                    │  Port 8010            │
                                    │ ONNX + RapidOCR +    │
                                    │ Gemini AI             │
                                    └───────────────────────┘
```

## 1. Server Selection Guide

### 1.1 Minimum Production Server (MVP / Early Traction)

| Component | Minimum Specification |
|-----------|----------------------|
| **CPU** | 4 cores (2 dedicated to Django, 1 for Celery, 1 reserved) |
| **RAM** | 8 GB |
| **Disk** | 50 GB SSD (PostgreSQL WAL + backups + logs) |
| **OS** | Ubuntu 22.04 LTS or CentOS Stream 9 |
| **Network** | 100 Mbps (for image uploads and AI traffic) |
| **Deployment** | Single-server deployment, all services on same machine |

### 1.2 Recommended Production Server (Scale)

| Component | Recommended Specification |
|-----------|--------------------------|
| **CPU** | 8+ cores |
| **RAM** | 16+ GB |
| **Disk** | 100+ GB SSD (or separate volumes for data/logs/backups) |
| **Separate DB** | External PostgreSQL + PostGIS instance or RDS |
| **Separate Redis** | External Redis (managed Redis/Elasticache) |
| **CDN** | CloudFront/Cloudflare for static assets |

### 1.3 Component Resource Budget (Single Server)

| Service | CPU Share | RAM | Disk | Notes |
|---------|-----------|-----|------|-------|
| PostgreSQL | 25% | 2-3 GB | 20+ GB | Most RAM = better caching |
| Redis | 10% | 1-2 GB | 2 GB | In-memory, no persistence needed on prod if AOF enabled |
| Django ASGI | 30% | 2-3 GB | 2 GB | Scales with Uvicorn workers |
| Celery Worker | 20% | 1-2 GB | 2 GB | Queue-heavy, needs disk for task results |
| AI Service | 10-15% | 1-2 GB | 5+ GB | ONNX model (~300MB) loaded in memory |
| Nginx | 5% | 256 MB | 1 GB | Static files + proxy |
| System + Logs | 5% | 512 MB | 5 GB | Reserve |

### 1.4 AI Service Requirements (Critical)

AI service has special needs:
- **Model weights**: ONNX file is ~280MB, must fit in RAM
- **Disk**: 5+ GB for model + temp uploads + dependencies
- **CPU**: Single worker is fine initially (ONNX CPU inference)
- **API**: Needs `GEMINI_API_KEY` — external internet access required

### 1.5 Scaling Recommendations

| Metric | Threshold to Scale | Action |
|--------|--------------------|--------|
| Active concurrent users | > 500 | Add more Uvicorn workers |
| Celery queue length | > 1000 tasks | Add more worker concurrency |
| PostgreSQL CPU | > 70% sustained | Add read replica or vertical scale |
| Redis memory | > 75% | Resize Redis instance |
| AI service latency | > 10s per request | Add GPU instance or multiple workers |
| Daily prescriptions | > 10,000 | Separate AI service to GPU instance |

---

## 2. Prerequisites

### 2.1 System Packages

```bash
# Ubuntu 22.04 LTS
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
    build-essential \
    libpq-dev \
    libproj-dev \
    proj-data \
    proj-bin \
    libgeos-dev \
    libgdal-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    libjpeg-dev \
    libpng-dev \
    zlib1g-dev \
    libffi-dev \
    git \
    curl \
    vim \
    htop \
    jq \
    bc \
    mailutils \
    logrotate \
    nginx \
    postgresql \
    postgresql-contrib \
    postgis \
    redis-server \
    pgbouncer
```

### 2.2 Python Version

- Python 3.11+ (tested with 3.12)

### 2.3 External Accounts Needed

| Service | Purpose |
|---------|---------|
| Cloud provider (AWS/DO/Linode) | Server hosting |
| Domain registrar | DNS for API + Support Web domains |
| Email provider (SMTP) | System emails, alert emails |
| Sentry account | Error monitoring (optional but recommended) |
| Google Cloud Console | Google OAuth, Maps API |
| MSG91 account | OTP delivery |
| Razorpay account | Payment processing |
| Expo (EAS) account | Mobile build service |
| AWS account | S3 for media storage |
| Google Gemini API | AI prescription extraction |
| Mapbox/Mappls/Mapbox | Maps provider |

---

## 3. Database Setup (PostgreSQL + PostGIS)

### Step 1: Initialize PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create DB user and database
sudo -u postgres psql << 'EOF'
CREATE USER <db-user> WITH PASSWORD '<db-password>';
CREATE DATABASE <db-name> OWNER <db-user>;
\c <db-name>
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
\q
EOF
```

### Step 2: Configure PgBouncer (Production)

Create `/etc/pgbouncer/pgbouncer.ini`:
```ini
[databases]
<db-name> = host=127.0.0.1 port=5432 dbname=<db-name>

[pgbouncer]
pool_mode = transaction
default_pool_size = 20
max_client_conn = 200
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
```

Create `/etc/pgbouncer/userlist.txt`:
```
"<db-user>" "<db-password>"
```

### Step 3: Configure PostgreSQL Settings

Edit `/etc/postgresql/*/main/postgresql.conf`:
```conf
shared_buffers = 2GB           # 25% of total RAM
effective_cache_size = 4GB     # 50% of total RAM
work_mem = 32MB
maintenance_work_mem = 512MB
max_connections = 200
max_worker_processes = 8
```

---

## 4. Redis Setup

```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Configure Redis to persist (optional for production)
sudo sed -i 's/^save ""/save 900 1 300 10 60 10000/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# Verify
redis-cli ping
```

---

## 5. Django Backend Deployment

### Step 1: Clone and Set Up

```bash
# Clone on server
git clone <repo-url> /opt/aarx/django
cd /opt/aarx/django

# Create Python virtual environment
python3 -m venv /opt/aarx/venv
source /opt/aarx/venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r django/requirements.txt
```

### Step 2: Configure Environment

```bash
# Create production env file (copy from template)
cp django/.env.production.example /opt/aarx/secrets/.env.production

# Edit and fill all placeholders
nano /opt/aarx/secrets/.env.production
```

Required variables to fill:
- `DJANGO_SECRET_KEY` — generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- `DJANGO_ALLOWED_HOSTS` — production API domain
- `DB_*` — PostgreSQL connection details
- `REDIS_*` — Redis URLs
- `CORS_ALLOWED_ORIGINS` — Support Web domain + mobile domains
- `S3 credentials` — AWS keys for media storage
- `SENTRY_DSN` — Sentry project DSN
- All external API keys (Google, Razorpay, MSG91, Maps)

### Step 3: Run Migrations

```bash
cd /opt/aarx/django
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py migrate --no-input
```

### Step 4: Collect Static Files

```bash
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py collectstatic --noinput
```

### Step 5: Run Django Checks

```bash
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py check --deploy
```

### Step 6: Create Superuser (if needed)

```bash
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py createsuperuser
```

### Step 7: Install Systemd Services

Edit `deploy/systemd/aarx-asgi.service.example`:
```bash
cp deploy/systemd/aarx-asgi.service.example /etc/systemd/system/aarx-asgi.service
# Edit: replace <deploy-user>, <absolute-path-to-venv>, <absolute-path-to-repo>, <absolute-path-to-secrets>, <worker-count>
```

```bash
cp deploy/systemd/aarx-celery.service.example /etc/systemd/system/aarx-celery.service
# Edit: replace placeholders similarly

cp deploy/systemd/aarx-celery-beat.service.example /etc/systemd/system/aarx-celery-beat.service
# Edit: replace placeholders similarly
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aarx-asgi aarx-celery aarx-celery-beat

# Check status
sudo systemctl status aarx-asgi aarx-celery aarx-celery-beat
```

---

## 6. AI Service Deployment

### Step 1: Set Up AI Service

```bash
# Clone or copy AI service
git clone <repo-url> /opt/aarx/ai_service
cd /opt/aarx/ai_service

# Create venv
python3 -m venv /opt/aarx/ai-venv
source /opt/aarx/ai-venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure AI Service Environment

The AI service uses a `.env` file. Create `.env` in the AI service directory:

```bash
cat > /opt/aarx/ai_service/.env << 'EOF'
GEMINI_API_KEY=<your-gemini-api-key>
AI_TIMEOUT_SECONDS=40
EOF
```

> **Note**: AI service ke liye `.env.production.example` file exist karta hai (`ai_service/.env.production.example`). Use karo.

### Step 3: Create Systemd Service for AI Service

Create `/etc/systemd/system/aarx-ai.service`:
```ini
[Unit]
Description=AARX AI Service (FastAPI)
After=network.target

[Service]
Type=simple
User=<deploy-user>
Group=<deploy-group>
WorkingDirectory=/opt/aarx/ai_service
ExecStart=/opt/aarx/ai-venv/bin/uvicorn main:app --host 127.0.0.1 --port 8010 --workers 1
Restart=always
RestartSec=5
EnvironmentFile=/opt/aarx/secrets/.env.production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aarx-ai
sudo systemctl status aarx-ai
```

> **Important**: AI service `127.0.0.1:8010` par sunti hai (internal only). Nginx ya koi bhi external access nahi chahiye.

### Step 4: Verify AI Service Integration

Django backend calls AI service at `http://127.0.0.1:8010/classify-prescription-image`. Ensure:
- AI service running on localhost:8010
- Gemini API key valid
- ONNX model file loaded correctly

---

## 7. Nginx Reverse Proxy Setup

### Step 1: Configure SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d <api-domain> -d <support-web-domain>
```

### Step 2: Install Nginx Config

Edit `deploy/nginx/aarx.conf.example`:
```bash
sudo cp deploy/nginx/aarx.conf.example /etc/nginx/sites-available/aarx.conf
# Replace:
# <api-domain>          → actual API domain (e.g., api.aarx.in)
# <support-web-domain>  → actual support web domain (e.g., support.aarx.in)
# <path-to-fullchain.pem> → /etc/letsencrypt/live/<domain>/fullchain.pem
# <path-to-privkey.pem>   → /etc/letsencrypt/live/<domain>/privkey.pem
# <absolute-path-to-repo> → /opt/aarx
```

```bash
sudo ln -sf /etc/nginx/sites-available/aarx.conf /etc/nginx/sites-enabled/aarx.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Support Web Static Files

```bash
# Build Support Web
cd /opt/aarx/support-web
npm ci
npm run build

# Files will be in /opt/aarx/support-web/dist
# Nginx config already serves from this path
```

---

## 8. Support Web Deployment

### Step 1: Copy and Configure

```bash
git clone <repo-url> /opt/aarx/support-web
cd /opt/aarx/support-web

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

npm ci
```

### Step 2: Configure Environment

```bash
cp .env.production.example .env.production.local
# Edit and replace placeholders:
# VITE_API_BASE_URL → https://<api-domain>/support-api/v1
# VITE_WS_BASE_URL → wss://<api-domain>
```

### Step 3: Build

```bash
npm run build
# Output: dist/ directory
```

### Step 4: Serve via Nginx

The Nginx config already has a server block for the Support Web domain serving `dist/`. After building, reload Nginx:

```bash
sudo systemctl reload nginx
```

### Step 5: Auto-rebuild on deploy (optional)

Add a deploy script:
```bash
#!/bin/bash
cd /opt/aarx/support-web
git pull
npm ci
npm run build
sudo systemctl reload nginx
```

---

## 9. Django Celery Configuration

### Step 1: Celery Worker

Edit `deploy/systemd/aarx-celery.service.example`:
```bash
# Replace placeholders:
# <deploy-user> → e.g., deploy
# <absolute-path-to-venv> → /opt/aarx/venv
# <absolute-path-to-repo> → /opt/aarx/django
# <absolute-path-to-secrets> → /opt/aarx/secrets
# <worker-concurrency> → CPU count * 4 (e.g., 16 for 4-core server)
```

### Step 2: Celery Beat

Edit `deploy/systemd/aarx-celery-beat.service.example`:
```bash
# Replace placeholders similarly
```

### Step 3: Verify Celery is Working

```bash
# Check worker
sudo systemctl status aarx-celery

# Inspect active workers
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/celery -A aarx -b redis://127.0.0.1:6379/0 inspect ping

# Check beat scheduler
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/celery -A aarx -b redis://127.0.0.1:6379/0 inspect beat
```

---

## 10. AARX Mobile App (Expo) Deployment

### Step 1: Configure Production Environment

```bash
cd /opt/aarx/AARXUI

# Copy production env template
cp .env.production.example .env.production
# Edit and fill:
# EXPO_PUBLIC_BASE_URL → https://<api-domain>
# EXPO_PUBLIC_MSG91_WIDGET_ID, MSG91_TOKEN_AUTH → from MSG91 dashboard
# EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID → Google OAuth client ID
# GOOGLE_MAPS_API_KEY → Android maps API key (for EAS build)
```

### Step 2: Update app.json for Production

**DO NOT change `app.json` without confirmation.** The current `bundleIdentifier` is `com.anonymous.AARXUI` — this is a placeholder. For production:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.aarx"  // ← change to real bundle ID
    },
    "android": {
      "package": "com.yourcompany.aarx"  // ← change to real package name
    }
  }
}
```

Also update for HTTPS-only (disable cleartext):
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSAppTransportSecurity": true  // remove the allowsArbitraryLoads
      }
    },
    "android": {
      "usesCleartextTraffic": false  // set to false for production
    }
  }
}
```

### Step 3: Build with EAS

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS (creates eas.json if not present)
eas build:configure

# Build for production
eas build --platform all --profile production
```

---

## 11. Monitoring Setup (Already Created)

### Step 1: Configure Monitoring Scripts

Edit each script in `deploy/scripts/` to replace placeholders:
- `backup-postgres.sh` → `<backup-dir>`, `<db-name>`, `<db-user>`, `<db-host>`, `<db-port>`
- `health-check.sh` → same DB/Redis/Celery placeholders
- `monitor-redis-celery.sh` → `<redis-broker-url>`, `<celery-pid-file>`, `<celery-queue>`
- `monitor-system.sh` → No placeholders (uses env vars for thresholds)
- `alert-server-failure.sh` → Already configured email to `rahulkolhe90.rk.rk@gmail.com`

### Step 2: Set Up Cron Jobs

```bash
# Edit crontab
sudo crontab -e

# Add:
# Daily PostgreSQL backup at 2 AM
0 2 * * * /opt/aarx/deploy/scripts/backup-postgres.sh >> /var/log/aarx/backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /opt/aarx/deploy/scripts/health-check.sh >> /var/log/aarx/health.log 2>&1

# Full monitoring every 15 minutes
*/15 * * * * /opt/aarx/deploy/scripts/monitor-all.sh >> /var/log/aarx/monitor.log 2>&1

# Server failure alert check every 10 minutes
*/10 * * * * /opt/aarx/deploy/scripts/alert-server-failure.sh >> /var/log/aarx/alert.log 2>&1
```

### Step 3: Log Rotation

```bash
# Copy logrotate configs (replace <log-dir> with actual paths)
sudo cp deploy/logrotate/aarx-nginx.conf /etc/logrotate.d/aarx-nginx
sudo cp deploy/logrotate/aarx-django.conf /etc/logrotate.d/aarx-django
sudo cp deploy/logrotate/aarx-celery.conf /etc/logrotate.d/aarx-celery

# Replace <log-dir> in each file with actual log path
sudo sed -i 's|<log-dir>|/var/log/aarx|g' /etc/logrotate.d/aarx-nginx /etc/logrotate.d/aarx-django /etc/logrotate.d/aarx-celery

# Test
sudo logrotate -d /etc/logrotate.d/aarx-nginx
```

### Step 4: Log Directories

```bash
sudo mkdir -p /var/log/aarx
sudo chown <deploy-user>:adm /var/log/aarx
sudo chmod 750 /var/log/aarx
```

---

## 12. Complete Deployment Order (Step by Step)

Follow this exact order for a smooth deployment:

1. **Server provisioning** — OS, system packages
2. **PostgreSQL + PgBouncer** — database setup (Section 3)
3. **Redis** — cache/broker/channel layer (Section 4)
4. **Django backend** — clone, env, migrate, systemd (Section 5)
5. **AI Service** — setup, venv, systemd (Section 6)
6. **Celery services** — start worker and beat (Section 9)
7. **Nginx + SSL** — reverse proxy setup (Section 7)
8. **Support Web** — build and serve (Section 8)
9. **Monitoring** — cron + logrotate (Section 11)
10. **AARX Mobile App** — EAS build (Section 10)

---

## 13. Post-Deployment Verification

| Check | Command |
|-------|---------|
| Django health | `curl -s https://<api-domain>/ | grep -i welcome` |
| Auth endpoint | `curl -s https://<api-domain>/api/user/login/ -X POST` |
| WebSocket | Connect via browser console to `wss://<api-domain>/ws/...` |
| Celery ping | `celery -A aarx inspect ping` |
| AI service | `curl http://127.0.0.1:8010/classify-prescription-image/` |
| PostgreSQL | `pg_isready -h 127.0.0.1 -p 6432` |
| Redis | `redis-cli ping` |
| Support Web | Visit `https://<support-web-domain>/` |
| Nginx | `sudo nginx -t` |
| Systemd status | `sudo systemctl status aarx-asgi aarx-celery aarx-celery-beat aarx-ai` |

---

## 14. Rollback Plan

If deployment fails:

1. Stop all AARX services: `sudo systemctl stop aarx-asgi aarx-celery aarx-celery-beat aarx-ai nginx`
2. Restore database from backup: `bash deploy/scripts/restore-postgres.sh <latest-backup>`
3. Revert to previous code: `cd /opt/aarx/django && git checkout <previous-commit>`
4. Restart: `sudo systemctl start postgresql redis-server pgbouncer nginx aarx-asgi aarx-celery aarx-celery-beat`
5. Rebuild Support Web from previous commit

---

## 15. Environment Variables Reference

### Django Production (.env.production)

| Variable | Required | Notes |
|----------|----------|-------|
| `DJANGO_SETTINGS_MODULE` | Yes | `aarx.settings_production` |
| `DJANGO_SECRET_KEY` | Yes | Generate random |
| `DJANGO_ALLOWED_HOSTS` | Yes | Comma-separated domains |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Yes | PostgreSQL details |
| `REDIS_BROKER_URL` | Yes | Redis URL for Celery |
| `REDIS_CHANNEL_URL` | Yes | Redis URL for WebSockets |
| `REDIS_CACHE_URL` | Yes | Redis URL for cache |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed origins |
| `SUPPORT_ATTACHMENT_MALWARE_SCAN_REQUIRED` | Yes | `true` in production |
| `API_RATE_LIMITING_ENABLED` | Yes | `true` in production |

### AI Service (.env)

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | Yes | Google Gemini AI API key |
| `AI_TIMEOUT_SECONDS` | No | Default: 40 |

### Support Web (.env.production.local)

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_BASE_URL` | Yes | `https://<api-domain>/support-api/v1` |
| `VITE_WS_BASE_URL` | Yes | `wss://<api-domain>` |

### AARXUI (.env.production)

| Variable | Required | Notes |
|----------|----------|-------|
| `EXPO_PUBLIC_BASE_URL` | Yes | `https://<api-domain>` |
| `EXPO_PUBLIC_MSG91_WIDGET_ID` | Yes | MSG91 widget ID |
| `EXPO_PUBLIC_MSG91_TOKEN_AUTH` | Yes | MSG91 auth token |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_MAPS_API_KEY` | Yes | For Android maps |

---

## 16. Common Issues and Troubleshooting

### Issue: WebSocket disconnects after Nginx
- Ensure Nginx config has proper `proxy_set_header Upgrade $http_upgrade` and `Connection "upgrade"`

### Issue: AI service timeout
- Check `AI_TIMEOUT_SECONDS` env var (default 40s)
- Verify `GEMINI_API_KEY` is valid and has quota
- Check ONNX model file exists

### Issue: Celery tasks not running
- Verify Redis is reachable
- Check `CELERY_BROKER_URL` in Django settings matches Redis
- Check systemd service is running

### Issue: S3 presigned URLs fail
- Verify clock sync: `sudo timedatectl set-ntp on`
- Check AWS credentials are correct
- Verify bucket name and region match

### Issue: Push notifications not working
- Verify Expo push token is saved (mobile app stores it)
- Check Expo push notification credentials in EAS
- Verify `notifications` Celery queue is active
