# AARX Platform - Full Production Architecture

## 1. High-Level Overview

```
                          ┌─────────────────────────────────────┐
                          │          Nginx Reverse Proxy         │
                          │   (HTTPS, SSL, Static Files,        │
                          │    WebSocket Upgrade)                │
                          └───────┬──────────────┬──────────────┘
                                  │              │
              ┌────────────────────┘              └────────────────────┐
              │                                                         │
     ┌────────▼────────┐                                   ┌───────────▼──────────┐
     │  AARX Mobile    │                                   │  Support Web (Admin) │
     │  App (Expo/RN)  │                                   │  (React + Vite)      │
     │  Android / iOS  │                                   │  Dashboard           │
     └─────────────────┘                                   └─────────────────────┘
              │                                                         │
              └────────────────────────┬────────────────────────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   Django ASGI Backend   │
                          │   (Uvicorn + Channels)  │
                          │   Port 8000 (internal)  │
                          └──────┬────────┬─────────┘
                                 │        │
                    ┌────────────┘        └────────────┐
                    │                                 │
          ┌─────────▼──────────┐           ┌──────────▼──────────┐
          │    PostgreSQL      │           │      Redis          │
          │   + PostGIS        │           │  (Broker + Cache +  │
          │   (Port 5432)      │           │   Channels Layer)   │
          └─────────┬──────────┘           └──────────┬──────────┘
                    │                                 │
                    │              ┌──────────────────┘
                    │              │
          ┌─────────▼──────────────▼──────────┐
          │        Celery Infrastructure       │
          │  ┌────────────┐  ┌──────────────┐ │
          │  │   Worker   │  │     Beat     │ │
          │  │ (Concurrency│  │ (Scheduler)  │ │
          │  │  = CPU*4)  │  │              │ │
          │  └─────┬──────┘  └──────┬───────┘ │
          │        │                │          │
          │        └────────┬───────┘          │
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │
               ┌────────────▼────────────┐
               │   AI Service (FastAPI)  │
               │   Port 8010 (internal)  │
               │   ONNX + RapidOCR +     │
               │   Gemini AI             │
               └─────────────────────────┘

               ┌─────────────────────────┐
               │   AWS S3 / MinIO        │
               │   (Media + Presigned    │
               │    URLs)                 │
               └─────────────────────────┘
```

## 2. Component Breakdown

### 2.1 Client Applications

| Component | Technology | Port/Endpoint | Purpose |
|-----------|-----------|---------------|---------|
| AARX Mobile App | React Native + Expo | Android/iOS native | Patient & pharmacy app |
| Support Web | React + Vite + Tailwind | `/support-web/` via Nginx | Admin/operations dashboard |
| Django Backend | Python + Django 5 + Channels | `127.0.0.1:8000` | Main API server |
| AI Service | FastAPI + ONNX + Gemini | `127.0.0.1:8010` | Prescription OCR + classification |

### 2.2 Reverse Proxy & Edge

| Component | Purpose | Config |
|-----------|---------|--------|
| Nginx | HTTPS termination, static files, WebSocket proxy, rate limiting | `deploy/nginx/aarx.conf.example` |
| SSL Certificate | HTTPS for API and Support Web domains | Let's Encrypt / custom CA |
| CDN (optional) | Static assets caching | CloudFront / Cloudflare |

### 2.3 Application Layer

| Component | Details |
|-----------|---------|
| **Django ASGI** | Uvicorn workers (`--workers N`). Handles HTTP REST API and WebSocket connections. |
| **Django Channels** | WebSocket routing for chat, orders, complaints, emergency monitoring. |
| **Django Apps** | `prescription`, `emergency_services`, `complaints`, `subscription`, `support_admin`. |
| **AI Service** | Independent FastAPI microservice. Django calls it for image classification. |
| **Celery Worker** | Background tasks: notifications, reminders, SLA monitoring, heartbeats. |
| **Celery Beat** | Periodic task scheduler (every 30s-60s intervals). |

### 2.4 Data Layer

| Component | Purpose | Details |
|-----------|---------|---------|
| **PostgreSQL + PostGIS** | Primary database | Stores users, stores, prescriptions, orders, GIS data, audit logs. |
| **PgBouncer** | Connection pooling | Transaction pool mode. `CONN_MAX_AGE = 0` in Django. |
| **Redis** | Multi-role | Celery broker (db 0), Django cache (db 1), Channels layer. |
| **AWS S3 / MinIO** | Object storage | Prescriptions, chat media, documents. Presigned URLs. |

### 2.5 Background Processing

| Queue | Tasks | Concurrency |
|-------|-------|-------------|
| `notifications` | Push notifications, in-app alerts, chat messages | High priority |
| `default` | SLA monitoring, heartbeats, cleanup | Normal priority |

### 2.6 Monitoring & Operations

| Script | Schedule | Purpose |
|--------|----------|---------|
| `backup-postgres.sh` | Daily 2 AM | PostgreSQL dump with 7-day retention |
| `health-check.sh` | Every 5 min | DB, Redis, Celery, disk checks |
| `monitor-system.sh` | Every 15 min | CPU, RAM, disk, load |
| `monitor-redis-celery.sh` | Every 15 min | Redis memory, queue length, Celery active tasks |
| `alert-server-failure.sh` | Every 10 min | Service down alerts + resource alerts |
| `monitor-all.sh` | Every 15 min | Combined monitoring entrypoint |

## 3. Network Flow

### 3.1 API Request (Mobile App)

```
Mobile App
    │
    ▼ HTTPS
Nginx (443)
    │
    ▼ HTTP proxy_pass
Django ASGI (127.0.0.1:8000)
    │
    ├──▶ PostgreSQL (via PgBouncer 6432)
    ├──▶ Redis (cache, channels)
    ├──▶ Celery Broker (task dispatch)
    ├──▶ AI Service (127.0.0.1:8010) — only for prescription image classification
    └──▶ S3 (presigned upload/download)
```

### 3.2 WebSocket Flow

```
Client (Mobile / Support Web)
    │
    ▼ wss://
Nginx (443)
    │ proxy_set_header Upgrade $http_upgrade
    ▼
Django Channels
    │
    ├──▶ Redis Channel Layer
    └──▶ Consumer (Chat, Orders, Monitoring, Notifications)
```

### 3.3 Background Task Flow

```
Django View / Signal / Celery Beat
    │
    ▼ enqueue task
Redis (Celery Broker)
    │
    ▼
Celery Worker
    │
    ├──▶ Django ORM (save results)
    ├──▶ Redis (cache updates)
    ├──▶ Push notification service (Expo / FCM)
    └──▶ AI Service (if needed)
```

### 3.4 AI Service Flow

```
Django (prescription upload)
    │
    ▼ HTTP POST /classify-prescription-image
AI Service (127.0.0.1:8010)
    │
    ├──▶ ONNX Model (image classification)
    ├──▶ RapidOCR (text extraction)
    └──▶ Gemini API (structured medicine extraction)
    │
    ▼ JSON Response
Django → Client
```

## 4. Process Tree

```
systemd
├── nginx
│   └── (reverse proxy)
├── postgresql
│   └── (database + PostGIS)
├── redis-server
│   └── (broker + cache + channels)
├── pgbouncer (optional but recommended)
│   └── (connection pooler)
├── aarx-asgi.service
│   ├── uvicorn aarx.asgi:application --workers N
│   └── (Django HTTP + WebSocket server)
├── aarx-celery.service
│   └── celery -A aarx worker -l info -Q notifications,default --concurrency=N
├── aarx-celery-beat.service
│   └── celery -A aarx beat -l info
└── ai-service (optional systemd unit)
    └── uvicorn main:app --workers 1 --port 8010
```

## 5. Data Storage

| Data Type | Storage | Retention |
|-----------|---------|-----------|
| User/Store profiles | PostgreSQL | Permanent |
| Prescriptions + images | PostgreSQL + S3 | Permanent |
| Orders + responses | PostgreSQL | Permanent |
| Chat messages + media | PostgreSQL + S3 | Permanent |
| Complaints + safety reports | PostgreSQL | Permanent |
| Subscriptions + payments | PostgreSQL | Permanent |
| Emergency service charges | PostgreSQL | Permanent |
| Support audit logs | PostgreSQL | Permanent |
| Celery task results | Django DB (django-celery-results) | Auto cleanup |
| Redis cache | Redis (db 1) | Ephemeral |
| Celery broker | Redis (db 0) | Ephemeral |
| PostgreSQL backups | Filesystem (`.sql.gz`) | 7 days |
| Nginx logs | Filesystem | 30 days (rotated) |
| Django logs | Filesystem | 30 days (rotated) |
| Celery logs | Filesystem | 14 days (rotated) |

## 6. Security Architecture

| Layer | Controls |
|-------|----------|
| **Transport** | HTTPS only, TLS 1.2+, HSTS, secure cookies |
| **Authentication** | Token auth (DRF SimpleJWT), Google OAuth, MSG91 OTP widget |
| **Authorization** | Role-based: patient, store, support staff, admin |
| **Rate Limiting** | Central API rate limiting + WebSocket connection limits |
| **Input Validation** | DRF serializers, Django ORM, CORS whitelist |
| **File Upload** | Malware scan enabled, S3 private bucket, presigned URLs |
| **Secrets** | Environment files / secret manager, never in repo |
| **Database** | PgBouncer pooling, no server-side cursors, restricted DB user |
| **AI Service** | Internal network only (`127.0.0.1`), timeout protection |
| **Monitoring** | Structured logging, Sentry DSN, production middleware |

## 7. Deployment Checklist

- [ ] Replace all `<placeholders>` in `deploy/` scripts and configs
- [ ] Set up SSL certificates for API and Support Web domains
- [ ] Configure `django/.env.production` with real secrets
- [ ] Run `python manage.py migrate --settings=aarx.settings_production`
- [ ] Run `python manage.py collectstatic --settings=aarx.settings_production`
- [ ] Install systemd services (`aarx-asgi`, `aarx-celery`, `aarx-celery-beat`)
- [ ] Install Nginx config and test `nginx -t`
- [ ] Set up logrotate configs in `/etc/logrotate.d/`
- [ ] Configure cron jobs for backup, health checks, and monitoring
- [ ] Test backup + restore on staging first
- [ ] Verify WebSocket connectivity through Nginx
- [ ] Verify S3 presigned URLs work
- [ ] Verify push notification tokens are valid
- [ ] Verify AI service timeout/fallback behavior
- [ ] Enable Sentry and verify error reporting
- [ ] Verify Support Web admin access controls

## 8. Scaling Considerations

| Component | Horizontal Scaling | Vertical Scaling |
|-----------|-------------------|------------------|
| Django ASGI | Multiple Uvicorn workers behind Nginx | Increase worker count |
| Celery Worker | Add more worker nodes | Increase concurrency per worker |
| Celery Beat | Single instance (or use `redbeat` for Redis-backed scheduling) | Not needed |
| PostgreSQL | Read replicas, sharding by city | Larger instance, more RAM |
| Redis | Redis Cluster / Sentinel | Larger instance |
| AI Service | Multiple instances behind internal load balancer | GPU instance for faster inference |
| Nginx | Multiple Nginx instances behind cloud load balancer | Not typically needed |

## 9. Known Constraints

1. **Local development untouched** — all production files are new additions in `deploy/`, `docs/`, and `.env.production.example`.
2. **PgBouncer required** — Django `CONN_MAX_AGE = 0` is mandatory for transaction pool mode.
3. **AI Service is synchronous** — long-running OCR calls should be offloaded to Celery if latency increases.
4. **WebSocket upgrade** — Nginx must pass `Upgrade` and `Connection` headers correctly.
5. **S3 presigned URLs** — require correct clock sync across servers.
6. **Mobile bundle IDs** — `com.anonymous.AARXUI` is placeholder; change before App Store submission.
