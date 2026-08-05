# Production readiness guide

This repo keeps local development unchanged. Production setup uses separate templates only.

## Files added for production

- `django/.env.production.example`: backend production environment template.
- `django/aarx/settings_production.py`: production-only Django settings wrapper.
- `support-web/.env.production.example`: Support Web production build variables.
- `AARXUI/.env.production.example`: Expo production build variables.
- `deploy/systemd/*.service.example`: production service templates.
- `deploy/nginx/aarx.conf.example`: reverse proxy and static hosting template.
- `deploy/scripts/production-checklist.sh`: validation script for a configured server.

## Local development

Do not change current local files for production:

- `django/.env`
- `django/.env.example`
- `support-web/.env.example`
- `AARXUI/.env`
- `AARXUI/.env.example`
- `AARXUI/app.json`
- `AARXUI/app.config.js`

## Required decisions before production launch

These values are intentionally placeholders and need project confirmation:

- Production API domain.
- Support Web domain.
- Mobile app bundle ID and Android package name.
- Database host/provider and backup policy.
- Redis host/provider and persistence/HA policy.
- S3 bucket name and region.
- Sentry project DSNs for backend, frontend, and mobile.
- Razorpay, MSG91, Google OAuth, Maps, WhatsApp provider credentials.

## Backend deployment outline

1. Copy `django/.env.production.example` to a secret-managed production env file.
2. Fill all placeholders; do not commit real secrets.
3. Install dependencies in the production venv with `pip install -r requirements.txt`.
4. Run migrations with `DJANGO_SETTINGS_MODULE=aarx.settings_production python manage.py migrate`.
5. Collect static files with `DJANGO_SETTINGS_MODULE=aarx.settings_production python manage.py collectstatic --noinput`.
6. Install systemd services from `deploy/systemd/*.service.example` after replacing placeholders.
7. Put Nginx in front of ASGI using `deploy/nginx/aarx.conf.example` after replacing placeholders.
8. Run `python manage.py check --deploy` using `aarx.settings_production`.

## Support Web deployment outline

1. Copy `support-web/.env.production.example` to the production build environment.
2. Fill API, WebSocket, version, and optional log endpoint values.
3. Run `npm ci` and `npm run build`.
4. Serve `support-web/dist` through Nginx or a static host.

## Expo app production outline

1. Copy `AARXUI/.env.production.example` into the EAS production environment or CI secrets.
2. Confirm production app identifiers before changing `AARXUI/app.json`.
3. Confirm HTTPS-only networking before changing cleartext/ATS settings.
4. Run `npm run lint` and an EAS production build.

## Go-live checks

- `DJANGO_DEBUG=false` in production.
- No wildcard `DJANGO_ALLOWED_HOSTS`.
- `CORS_ALLOW_ALL_ORIGINS=false`.
- HTTPS redirect and HSTS enabled.
- Database backups tested with restore.
- Redis persistence/HA plan confirmed.
- Sentry or equivalent alerting enabled.
- Celery worker and beat services monitored.
- Support Web admin monitoring page accessible only to admin users.
- Mobile app uses HTTPS production API.
