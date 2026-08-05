# AARX Production Operations

This document describes the production operations scripts and configurations added to the repository. All files are in `deploy/` and use placeholders. Local development files are not modified.

## Directory Layout

```
deploy/
  scripts/
    backup-postgres.sh          # Daily PostgreSQL backup
    restore-postgres.sh         # Point-in-time restore helper
    health-check.sh             # PostgreSQL, Redis, Celery, disk checks
    monitor-redis-celery.sh     # Redis memory, clients, queue length
    monitor-system.sh           # CPU, RAM, disk, load averages
    alert-server-failure.sh     # Service-status and resource alerting
    monitor-all.sh              # Run all checks in sequence
  logrotate/
    aarx-nginx.conf             # Nginx access/error log rotation
    aarx-django.conf            # Django/Uvicorn log rotation
    aarx-celery.conf            # Celery worker/beat log rotation
  nginx/
    aarx.conf.example           # Existing reverse proxy template
  systemd/
    aarx-asgi.service.example   # Existing ASGI service template
    aarx-celery.service.example # Existing Celery service template
    aarx-celery-beat.service.example # Existing Celery Beat template
```

## Prerequisites

- PostgreSQL client tools (`pg_dump`, `pg_isready`, `psql`)
- Redis CLI (`redis-cli`)
- `bc` for floating-point comparisons in system monitoring
- `mail` or `sendmail` for email alerts (optional)
- Log rotation managed by `logrotate` or a compatible cron-based rotator

## Backup and Restore

### Daily Backup

Edit `deploy/scripts/backup-postgres.sh` and replace the placeholders:

- `<backup-dir>` - directory where `.sql.gz` files are stored
- `<db-name>`, `<db-user>`, `<db-host>`, `<db-port>` - database connection details

Set up a cron job:

```
0 2 * * * /path/to/repo/deploy/scripts/backup-postgres.sh >> /var/log/aarx/backup.log 2>&1
```

The script retains backups for 7 days and deletes older files automatically.

### Restore

Edit `deploy/scripts/restore-postgres.sh` with the same placeholders.

Usage:

```
bash deploy/scripts/restore-postgres.sh /path/to/backup/file.sql.gz
```

The script prompts for confirmation before overwriting the database.

## Health Checks

Edit `deploy/scripts/health-check.sh` with the placeholders, then run:

```
bash deploy/scripts/health-check.sh
```

Checks performed:

1. PostgreSQL connection readiness
2. Redis PING response
3. Celery worker process state via PID file
4. Root filesystem disk usage

Exit code is non-zero if any critical check fails.

## Monitoring

### Redis and Celery

```
bash deploy/scripts/monitor-redis-celery.sh
```

Reports:

- Redis memory usage
- Connected Redis clients
- Queue length for the configured Celery queue
- Celery worker active process count

### System Resources

```
bash deploy/scripts/monitor-system.sh
```

Reports:

- CPU usage percentage
- RAM usage percentage and absolute values
- Disk usage per mounted filesystem
- System load average

Thresholds are configurable via environment variables:

- `CPU_WARN` (default: 80)
- `CPU_CRIT` (default: 95)
- `RAM_WARN` (default: 80)
- `RAM_CRIT` (default: 95)
- `DISK_WARN` (default: 75)
- `DISK_CRIT` (default: 90)

### Combined Monitoring

```
bash deploy/scripts/monitor-all.sh
```

Runs health, system, and Redis/Celery checks in sequence.

## Alerting

Edit `deploy/scripts/alert-server-failure.sh` and replace:

- `<alert-webhook-url>` - Slack, Discord, or generic webhook endpoint
- `<alert-email>` - email address for critical alerts

Usage:

```
bash deploy/scripts/alert-server-failure.sh
```

The script checks:

- Django ASGI service state
- Celery worker service state
- Celery Beat service state
- Nginx service state
- PostgreSQL service state
- Redis service state
- Disk usage
- RAM usage

Critical failures trigger both webhook and email alerts. Warnings trigger alerts for high resource usage.

## Log Rotation

The `deploy/logrotate/` directory contains three configurations:

1. `aarx-nginx.conf` - rotates Nginx access and error logs daily, keeps 30 compressed copies
2. `aarx-django.conf` - rotates Django application logs daily, keeps 30 compressed copies
3. `aarx-celery.conf` - rotates Celery worker and beat logs daily, keeps 14 compressed copies

Replace `<log-dir>` with the actual log directory path in each file, then install them into `/etc/logrotate.d/` or include them in your logrotate configuration.

## Systemd Services

The existing templates in `deploy/systemd/` are generic production templates. Replace placeholders before installing:

- `<deploy-user>` and `<deploy-group>` - service runtime account
- `<absolute-path-to-repo>` - cloned repository path
- `<absolute-path-to-venv>` - Python virtual environment path
- `<absolute-path-to-secrets>` - directory containing `.env.production`
- `<worker-count>` - Uvicorn worker count
- `<worker-concurrency>` - Celery concurrency

Install after customization:

```
cp deploy/systemd/aarx-asgi.service.example /etc/systemd/system/aarx-asgi.service
cp deploy/systemd/aarx-celery.service.example /etc/systemd/system/aarx-celery.service
cp deploy/systemd/aarx-celery-beat.service.example /etc/systemd/system/aarx-celery-beat.service

systemctl daemon-reload
systemctl enable --now aarx-asgi aarx-celery aarx-celery-beat
```

## Cron Recommendations

```
# Daily PostgreSQL backup at 2 AM
0 2 * * * /path/to/repo/deploy/scripts/backup-postgres.sh >> /var/log/aarx/backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /path/to/repo/deploy/scripts/health-check.sh >> /var/log/aarx/health.log 2>&1

# Full monitoring every 15 minutes
*/15 * * * * /path/to/repo/deploy/scripts/monitor-all.sh >> /var/log/aarx/monitor.log 2>&1

# Server failure alert check every 10 minutes
*/10 * * * * /path/to/repo/deploy/scripts/alert-server-failure.sh >> /var/log/aarx/alert.log 2>&1
```

## Security Notes

- Do not commit real secrets, passwords, or private keys.
- Restrict backup directory permissions: `chmod 700 <backup-dir>`
- Ensure log directories are writable by the service user only.
- Rotate and securely delete old backups if they contain sensitive data.
