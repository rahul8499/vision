#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - PostgreSQL Restore Script
# Placeholders: <backup-dir>, <db-name>, <db-user>, <db-host>, <db-port>
# ============================================================

BACKUP_DIR="<backup-dir>"
DB_NAME="<db-name>"
DB_USER="<db-user>"
DB_HOST="<db-host>"
DB_PORT="<db-port>"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file>"
    echo "Available backups:"
    ls -1t "$BACKUP_DIR"/aarx_backup_*.sql.gz 2>/dev/null || echo "  (none found)"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will overwrite the current database '$DB_NAME'."
read -p "Type 'YES' to confirm restore: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "Restore cancelled."
    exit 0
fi

export PGPASSWORD="${DB_PASSWORD:-}"

echo "[$(date)] Starting PostgreSQL restore from $BACKUP_FILE..."

gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --set ON_ERROR_STOP=on

echo "[$(date)] Restore completed successfully."
