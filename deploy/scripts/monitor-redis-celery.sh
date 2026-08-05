#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - Redis and Celery Monitoring
# Placeholders: <redis-broker-url>, <celery-pid-file>, <celery-queue>
# ============================================================

REDIS_URL="<redis-broker-url>"
CELERY_PID_FILE="<celery-pid-file>"
CELERY_QUEUE="<celery-queue>"
REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's/.*@([^:]+):.*/\1/' | sed -E 's/.*:\/\/([^:/]+).*/\1/')
REDIS_PORT=$(echo "$REDIS_URL" | grep -oE ':[0-9]+' | head -1 | tr -d ':')

echo "=== Redis Status ==="

if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    echo "[OK] Redis PING"

    REDIS_MEMORY=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    echo "  Memory usage: $REDIS_MEMORY"

    REDIS_CONNECTED=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
    echo "  Connected clients: $REDIS_CONNECTED"

    QUEUE_LENGTH=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" llen "$CELERY_QUEUE" 2>/dev/null || echo "N/A")
    echo "  Queue length ($CELERY_QUEUE): $QUEUE_LENGTH"
else
    echo "[FAIL] Redis is not responding"
    exit 1
fi

echo ""
echo "=== Celery Status ==="

if [ -f "$CELERY_PID_FILE" ]; then
    PID=$(cat "$CELERY_PID_FILE" 2>/dev/null || echo "")
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "[OK] Celery worker is running (PID: $PID)"

        if command -v celery >/dev/null 2>&1; then
            celery -A aarx inspect active 2>/dev/null || echo "[WARN] Could not inspect Celery tasks"
        fi
    else
        echo "[FAIL] Celery worker process not running"
        exit 1
    fi
else
    echo "[WARN] Celery PID file not found"
fi
