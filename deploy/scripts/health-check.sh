#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - Service Health Check
# Placeholders: <db-name>, <db-user>, <db-host>, <db-port>,
#               <redis-broker-url>, <celery-pid-file>
# ============================================================

DB_NAME="<db-name>"
DB_USER="<db-user>"
DB_HOST="<db-host>"
DB_PORT="<db-port>"
REDIS_URL="<redis-broker-url>"
CELERY_PID_FILE="<celery-pid-file>"
EXIT_CODE=0

check_postgres() {
    export PGPASSWORD="${DB_PASSWORD:-}"
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        echo "[OK] PostgreSQL is accepting connections"
    else
        echo "[FAIL] PostgreSQL is not ready"
        EXIT_CODE=1
    fi
}

check_redis() {
    REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's/.*@([^:]+):.*/\1/' | sed -E 's/.*:\/\/([^:/]+).*/\1/')
    REDIS_PORT=$(echo "$REDIS_URL" | grep -oE ':[0-9]+' | head -1 | tr -d ':')

    if [ -z "$REDIS_HOST" ] || [ -z "$REDIS_PORT" ]; then
        echo "[SKIP] Could not parse Redis URL"
        return
    fi

    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
        echo "[OK] Redis is responding to PING"
    else
        echo "[FAIL] Redis is not responding"
        EXIT_CODE=1
    fi
}

check_celery() {
    if [ -f "$CELERY_PID_FILE" ]; then
        PID=$(cat "$CELERY_PID_FILE" 2>/dev/null || echo "")
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            echo "[OK] Celery worker is running (PID: $PID)"
        else
            echo "[FAIL] Celery worker PID file exists but process is not running"
            EXIT_CODE=1
        fi
    else
        echo "[WARN] Celery PID file not found at $CELERY_PID_FILE"
    fi
}

check_disk() {
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$DISK_USAGE" -gt 90 ]; then
        echo "[FAIL] Disk usage is critical: ${DISK_USAGE}%"
        EXIT_CODE=1
    elif [ "$DISK_USAGE" -gt 75 ]; then
        echo "[WARN] Disk usage is high: ${DISK_USAGE}%"
    else
        echo "[OK] Disk usage is acceptable: ${DISK_USAGE}%"
    fi
}

check_postgres
check_redis
check_celery
check_disk

exit $EXIT_CODE
