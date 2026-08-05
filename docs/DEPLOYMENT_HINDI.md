# AARX Full Production Deployment Guide — Hindi Edition

**IMPORTANT:** Local development files को कभी भी नहीं छूना है। सारे commands production server पर चलाएँ।

---

## 1. Server Ka Selection Kaise Karein

### Minimum Server (Testing/MVP):
| Part | Kitna Chahiye |
|------|---------------|
| **CPU** | 4 cores |
| **RAM** | 8 GB |
| **Disk** | 50 GB SSD |
| **OS** | Ubuntu 22.04 LTS |

### Production Server (Real Use):
| Part | Kitna Chahiye |
|------|---------------|
| **CPU** | 8+ cores |
| **RAM** | 16+ GB |
| **Disk** | 100+ GB SSD |
| **Bandwidth** | जितना ज़्यादा उतना बेहतर |

### AI Service Ke Liye Extra:
- ONNX model ~280MB RAM mein rehta hai
- Gemini API key chahiye (Google Cloud से)

---

## 2. System Packages Install Karni Hain (Server Pe)

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y \
    build-essential \
    libpq-dev \
    libproj-dev \
    proj-data \
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
    logrotate \
    nginx \
    postgresql \
    postgresql-contrib \
    postgis \
    redis-server \
    pgbouncer

# Python 3.12 install
sudo apt install -y python3.12 python3.12-venv python3.12-dev

# Node.js 20 install
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 3. PostgreSQL + PostGIS + PgBouncer Setup

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Database + user create karo
sudo -u postgres psql << 'EOF'
CREATE USER aarx WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE aarxdb OWNER aarx;
\c aarxdb
CREATE EXTENSION IF NOT EXISTS postgis;
\q
EOF

# PgBouncer config (connection pool ke liye)
sudo tee /etc/pgbouncer/pgbouncer.ini > /dev/null << 'EOF'
[databases]
aarxdb = host=127.0.0.1 port=5432 dbname=aarxdb

[pgbouncer]
pool_mode = transaction
default_pool_size = 20
max_client_conn = 200
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
EOF

echo "aarx YOUR_SECURE_PASSWORD" | sudo tee /etc/pgbouncer/userlist.txt
sudo systemctl restart pgbouncer
```

---

## 4. Redis Setup

```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Persistence enable (optional)
sudo sed -i 's/^save ""/save 900 1 300 10 60 10000/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# Check
redis-cli ping
# Reply hona chahiye: PONG
```

---

## 5. Django Backend Deploy

### Step 1: Clone karke laye
```bash
mkdir -p /opt/aarx
sudo git clone <your-repo-url> /opt/aarx/django
cd /opt/aarx/django

# Folder structure:
# django/          <-- Django code
# ai_service/      <-- AI FastAPI service  
# AARXUI/          <-- Mobile app
# support-web/     <-- Admin dashboard
```

### Step 2: Python virtual environment
```bash
python3.12 -m venv /opt/aarx/venv
source /opt/aarx/venv/bin/activate

# Dependencies install
cd /opt/aarx/django
pip install -r requirements.txt
pip install gunicorn
```

### Step 3: Environment file setup
```bash
sudo mkdir -p /opt/aarx/secrets
sudo cp django/.env.production.example /opt/aarx/secrets/.env.production
sudo nano /opt/aarx/secrets/.env.production
```

**Jin values ko fill karna zaroori hai:**

| Variable | Kya daalna hai |
|----------|----------------|
| `DJANGO_SECRET_KEY` | Random string (generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| `DJANGO_ALLOWED_HOSTS` | API domain, e.g., `api.aarx.in` |
| `DB_NAME` | `aarxdb` |
| `DB_USER` | `aarx` |
| `DB_PASSWORD` | jo password diya |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `6432` (PgBouncer port) |
| `REDIS_BROKER_URL` | `redis://127.0.0.1:6379/0` |
| `REDIS_CHANNEL_URL` | `redis://127.0.0.1:6379/0` |
| `REDIS_CACHE_URL` | `redis://127.0.0.1:6379/1` |
| `CORS_ALLOWED_ORIGINS` | `https://support.aarx.in,https://aarx.in` |
| `S3 credentials` | AWS keys |
| `SENTRY_DSN` | Sentry project DSN (optional) |
| `Razorpay/Gemini/MSG91 keys` | Provider credentials |

### Step 4: Migrate + Collectstatic
```bash
cd /opt/aarx/django

# Database migrate
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py migrate --no-input

# Static files collect
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py collectstatic --noinput

# Django checks
DJANGO_SETTINGS_MODULE=aarx.settings_production /opt/aarx/venv/bin/python manage.py check --deploy
```

### Step 5: Systemd service install (Uvicorn)

Edit `deploy/systemd/aarx-asgi.service.example`:
```bash
sudo cp deploy/systemd/aarx-asgi.service.example /etc/systemd/system/aarx-asgi.service
sudo nano /etc/systemd/system/aarx-asgi.service
```

Replace:
- `<deploy-user>` → `deploy` (ya jo user bhi chahiye)
- `<absolute-path-to-repo>` → `/opt/aarx`
- `<absolute-path-to-venv>` → `/opt/aarx/venv`
- `<absolute-path-to-secrets>` → `/opt/aarx/secrets`
- `<worker-count>` → CPU count * 2 (e.g., 8 for 4-core)

```bash
# Deploy user create karo (agar nahi hai to)
sudo adduser --system --group deploy

# Permissions set karo
sudo chown -R deploy:deploy /opt/aarx/
sudo chmod +x /etc/systemd/system/aarx-asgi.service

# Start service
sudo systemctl daemon-reload
sudo systemctl enable --now aarx-asgi
sudo systemctl status aarx-asgi
```

---

## 6. AI Service Deploy

```bash
# AI service ke liye alag venv
python3.12 -m venv /opt/aarx/ai-venv
source /opt/aarx/ai-venv/bin/activate
cd /opt/aarx/ai_service
pip install -r requirements.txt

# Env file set karo
cp .env.example .env.production
nano .env.production
# Fill: GEMINI_API_KEY=<your-gemini-api-key>
# Fill: AI_TIMEOUT_SECONDS=40
```

Systemd service (`deploy/systemd/aarx-ai.service.example` edit karo):
```bash
sudo cp deploy/systemd/aarx-ai.service.example /etc/systemd/system/aarx-ai.service
sudo nano /etc/systemd/system/aarx-ai.service
# Replace placeholders

sudo systemctl daemon-reload
sudo systemctl enable --now aarx-ai
sudo systemctl status aarx-ai
```

> AI service `127.0.0.1:8010` par sirf internal access ke liye hai. Koi external access nahi.

---

## 7. Celery Worker + Beat Deploy

Edit `deploy/systemd/aarx-celery.service.example`:
```bash
sudo cp deploy/systemd/aarx-celery.service.example /etc/systemd/system/aarx-celery.service
# Replace placeholders (same as ASGI)

sudo cp deploy/systemd/aarx-celery-beat.service.example /etc/systemd/system/aarx-celery-beat.service
# Replace placeholders

sudo systemctl daemon-reload
sudo systemctl enable --now aarx-celery aarx-celery-beat
sudo systemctl status aarx-celery aarx-celery-beat
```

**Verify:**
```bash
source /opt/aarx/venv/bin/activate
DJANGO_SETTINGS_MODULE=aarx.settings_production celery -A aarx -b redis://127.0.0.1:6379/0 inspect ping
# Sab workers PONG kehkar reply karenge
```

---

## 8. Nginx + SSL Setup

### SSL Certificate (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.aarx.in -d support.aarx.in
```

### Nginx Config:
```bash
sudo cp deploy/nginx/aarx.conf.example /etc/nginx/sites-available/aarx.conf
sudo nano /etc/nginx/sites-available/aarx.conf
```

Replace karo:
- `<api-domain>` → `api.aarx.in`
- `<support-web-domain>` → `support.aarx.in`
- `<path-to-fullchain.pem>` → `/etc/letsencrypt/live/api.aarx.in/fullchain.pem`
- `<path-to-privkey.pem>` → `/etc/letsencrypt/live/api.aarx.in/privkey.pem`
- `<absolute-path-to-repo>` → `/opt/aarx`

```bash
sudo ln -sf /etc/nginx/sites-available/aarx.conf /etc/nginx/sites-enabled/aarx.conf
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Support Web Deploy

```bash
cd /opt/aarx/support-web

# Copy production env
cp .env.production.example .env.production.local
nano .env.production.local
# VITE_API_BASE_URL=https://api.aarx.in/support-api/v1
# VITE_WS_BASE_URL=wss://api.aarx.in

# Build
npm ci
npm run build

# Build hone ke baad /opt/aarx/support-web/dist banega
# Nginx usse serve karega
sudo systemctl reload nginx
```

---

## 10. AARX Mobile App (EAS Build)

```bash
cd /opt/aarx/AARXUI

# Production env
cp .env.production.example .env.production
nano .env.production
# EXPO_PUBLIC_BASE_URL=https://api.aarx.in  (HTTPS)
# MSG91 + Google keys fill karo

# Bundle ID change (app.json)
# Current: com.anonymous.AARXUI
# Production: com.yourcompany.aarxchange

# EAS build
npm install -g eas-cli
eas login
eas build --platform all --profile production
```

> **Warning:** Bundle ID aur cleartext traffic tabhi change karein jab production domain aur HTTPS confirm ho chuka ho.

---

## 11. Monitoring + Cron Setup

### Scripts ko configure karo:
```bash
cd /opt/aarx/deploy/scripts

# Backup script
nano backup-postgres.sh
# Replace: <backup-dir>, <db-name>, <db-user>, <db-host>, <db-port>

# Health check
nano health-check.sh
# Replace: DB details, Redis URL, Celery PID file path

# System monitor (no placeholders, just env vars optional)

# Redis-Celery monitor
nano monitor-redis-celery.sh
# Replace: Redis URL, Celery PID file, queue name

# Alert script (already configured for rahulkolhe90.rk.rk@gmail.com)
# Webhook URL add karo agar chahiye:
nano alert-server-failure.sh
# ALERT_WEBHOOK_URL="https://hooks.slack.com/services/..."  # agar Slack chahiye
```

### Cron jobs set karo:
```bash
sudo mkdir -p /var/log/aarx
sudo chown $(whoami):$(whoami) /var/log/aarx

# Crontab edit karo
crontab -e

# Add these lines:
# Daily backup at 2 AM
0 2 * * * /opt/aarx/deploy/scripts/backup-postgres.sh >> /var/log/aarx/backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /opt/aarx/deploy/scripts/health-check.sh >> /var/log/aarx/health.log 2>&1

# Full monitoring every 15 minutes
*/15 * * * * /opt/aarx/deploy/scripts/monitor-all.sh >> /var/log/aarx/monitor.log 2>&1

# Server alert check every 10 minutes
*/10 * * * * /opt/aarx/deploy/scripts/alert-server-failure.sh >> /var/log/aarx/alert.log 2>&1
```

### Log Rotation:
```bash
sudo mkdir -p /var/log/aarx

# Copy and configure
sudo cp /opt/aarx/deploy/logrotate/aarx-nginx.conf /etc/logrotate.d/aarx-nginx
sudo cp /opt/aarx/deploy/logrotate/aarx-django.conf /etc/logrotate.d/aarx-django
sudo cp /opt/aarx/deploy/logrotate/aarx-celery.conf /etc/logrotate.d/aarx-celery

# Replace <log-dir> with /var/log/aarx
sudo sed -i 's|<log-dir>|/var/log/aarx|g' /etc/logrotate.d/aarx-nginx /etc/logrotate.d/aarx-django /etc/logrotate.d/aarx-celery

# Test
sudo logrotate -d /etc/logrotate.d/aarx-nginx
```

---

## 12. Systemd Service Files Ko Update Karne Ka Tarika

Agar koi service file change kiya to yeh steps follow karo:

```bash
# Example: agar ASGI service change kiya
sudo systemctl daemon-reload
sudo systemctl restart aarx-asgi
sudo systemctl status aarx-asgi
```

---

## 13. Post-Deployment Verification

```bash
# Django running?
curl -s https://api.aarx.in/ | head -1
# Should show: <h1>Welcome to the Medical Prescription App API</h1>

# Login endpoint
curl -s https://api.aarx.in/api/user/login/ -X POST
# Should return JSON error (not 502)

# PostgreSQL
sudo -u postgres psql -c "SELECT version();"
# Should show PostgreSQL + PostGIS version

# Redis
redis-cli ping
# PONG

# Celery workers alive?
curl -s https://api.aarx.in/support-api/v1/health/runtime/
# Should return OK

# Nginx
sudo nginx -t
# Syntax OK

# Systemd services
sudo systemctl status aarx-asgi aarx-celery aarx-celery-beat aarx-ai nginx postgresql redis-server

# WebSocket test (browser console)
# new WebSocket("wss://api.aarx.in/ws/chat/1/")
# Should connect without error
```

---

## 14. Rollback Plan (Agar Kuchh Galat Ho To)

```bash
# 1. Stop sabhi services
sudo systemctl stop aarx-asgi aarx-celery aarx-celery-beat aarx-ai nginx

# 2. Database restore (latest backup se)
gunzip -c /path/to/backup/file.sql.gz | psql -U aarx -d aarxdb -h 127.0.0.1

# 3. Previous code pe jao
cd /opt/aarx/django
sudo git checkout <previous-working-commit>

# 4. Restart
sudo systemctl start postgresql redis-server pgbouncer nginx aarx-asgi aarx-celery aarx-celery-beat aarx-ai
```

---

## 15. Troubleshooting (Samasya Solutions)

| Problem | Solution |
|---------|----------|
| **502 Bad Gateway** | `sudo systemctl status aarx-asgi` check karo — service down ho sakta hai |
| **WebSocket nahi jod raha** | Nginx config me `proxy_set_header Upgrade $http_upgrade` missing ho sakta hai |
| **Push notifications nahi aate** | Expo push token check karo, Celery notifications queue active hai ya nahi |
| **AI service timeout** | `GEMINI_API_KEY` valid hai ya nahi, model file load ho raha hai ya nahi |
| **S3 upload fail** | AWS credentials confirm karo, presigned URL expiry check karo |
| **Cron nahi chalti** | `sudo crontab -l` check karo, logs `/var/log/aarx/` mein dekho |
| **Log rotation nahi hoti** | `sudo logrotate -f /etc/logrotate.d/aarx-nginx` try karo |
| **Database slow** | `sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"` check karo — lock ya idle connections |

---

## 16. Environment Variables Checklist

### Django (.env.production):
```
✅ DJANGO_SECRET_KEY
✅ DJANGO_ALLOWED_HOSTS
✅ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
✅ REDIS_BROKER_URL, REDIS_CHANNEL_URL, REDIS_CACHE_URL
✅ CORS_ALLOWED_ORIGINS
✅ SENTRY_DSN (optional)
✅ AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_STORAGE_BUCKET_NAME, AWS_S3_REGION_NAME
✅ RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
✅ EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD
✅ EXPO_PUBLIC_BASE_URL (agar koi frontend local test ke liye chahiye)
```

### AI Service (.env):
```
✅ GEMINI_API_KEY
✅ AI_TIMEOUT_SECONDS (default 40)
```

### Support Web (.env.production.local):
```
✅ VITE_API_BASE_URL
✅ VITE_WS_BASE_URL
```

### AARX Mobile (.env.production):
```
✅ EXPO_PUBLIC_BASE_URL (HTTPS URL)
✅ EXPO_PUBLIC_MSG91_WIDGET_ID
✅ EXPO_PUBLIC_MSG91_TOKEN_AUTH
✅ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
✅ GOOGLE_MAPS_API_KEY (Android maps)
```

---

## 17. Daily Operations Commands

```bash
# Service status check
sudo systemctl status aarx-asgi aarx-celery aarx-celery-beat aarx-ai nginx

# Logs dekho
sudo journalctl -u aarx-asgi -f --no-pager
sudo journalctl -u aarx-celery -f --no-pager
sudo tail -f /var/log/aarx/health.log

# Health check manually run
/opt/aarx/deploy/scripts/health-check.sh

# Manual backup
/opt/aarx/deploy/scripts/backup-postgres.sh

# Restart karo kisi bhi service ko
sudo systemctl restart aarx-asgi
```

---

## 18. Deployment Order Summary (Yaad Rakho)

1. ✅ Server provision (OS, packages)
2. ✅ PostgreSQL + PgBouncer + Redis
3. ✅ Django backend (clone, env, migrate, systemd)
4. ✅ AI Service (venv, env, systemd)
5. ✅ Celery services (worker + beat)
6. ✅ Nginx + SSL
7. ✅ Support Web (build)
8. ✅ Monitoring (cron + logrotate)
9. ✅ Verify sab kuch chal raha hai
10. ✅ Mobile app EAS build

---

## 19. Important Warnings

⚠️ **Local development files न हँसाएं** — `.env`, `app.json`, `.env.example` etc. सिर्फ production templates (`*.production.example`) use karo

⚠️ **Secrets GitHub पर नहीं जाएं** — `.env.production` file server par hi रहना चाहिए, git ignore list mein होना चाहिए

⚠️ **Backup test karo** — restore script test ke liye ek staging server pe try karo pehle

⚠️ **Bundle ID change** — mobile app ke liye अलग से poocha jaayega qki yeh production identifiers hote hain

⚠️ **AI service internal** — koi external access नहीं चाहिए, sirf Django backend se call hoti hai
