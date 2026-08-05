#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - Combined Production Monitoring Entrypoint
# Runs health, system, and Redis/Celery checks in sequence.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXIT_CODE=0

echo "============================================"
echo "AARX Production Monitoring"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "============================================"
echo ""

echo ">>> Health Check"
if ! bash "$SCRIPT_DIR/health-check.sh"; then
    EXIT_CODE=1
fi
echo ""

echo ">>> System Resource Check"
if ! bash "$SCRIPT_DIR/monitor-system.sh"; then
    EXIT_CODE=1
fi
echo ""

echo ">>> Redis and Celery Check"
if ! bash "$SCRIPT_DIR/monitor-redis-celery.sh"; then
    EXIT_CODE=1
fi
echo ""

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "============================================"
    echo "All monitoring checks passed."
    echo "============================================"
else
    echo "============================================"
    echo "One or more monitoring checks failed."
    echo "============================================"
fi

exit $EXIT_CODE
