#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - PostgreSQL Backup Script
# Placeholders: <backup-dir>, <db-name>, <db-user>, <db-host>, <db-port>
# ============================================================

BACKUP_DIR="<backup-dir>"
DB_NAME="<db-name>"
DB_USER="<db-user>"
DB_HOST="<db-host>"
DB_PORT="<db-port>"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aarx_backup_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

export PGPASSWORD="${DB_PASSWORD:-}"

echo "[$(date)] Starting PostgreSQL backup..."

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-acl \
    --verbose \
    --exclude-schema=public \
    2>&1 | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup completed: $BACKUP_FILE"

find "$BACKUP_DIR" -name "aarx_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Retaining backups from the last $RETENTION_DAYS days."
