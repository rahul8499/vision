#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - System Resource Monitoring
# Thresholds: CPU_WARN, CPU_CRIT, RAM_WARN, RAM_CRIT, DISK_WARN, DISK_CRIT
# ============================================================

CPU_WARN=${CPU_WARN:-80}
CPU_CRIT=${CPU_CRIT:-95}
RAM_WARN=${RAM_WARN:-80}
RAM_CRIT=${RAM_CRIT:-95}
DISK_WARN=${DISK_WARN:-75}
DISK_CRIT=${DISK_CRIT:-90}
EXIT_CODE=0

check_cpu() {
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | tr -d ' ')
    CPU_USAGE=${CPU_USAGE:-0}

    if [ "$(echo "$CPU_USAGE >= $CPU_CRIT" | bc -l)" -eq 1 ]; then
        echo "[CRITICAL] CPU usage is ${CPU_USAGE}%"
        EXIT_CODE=1
    elif [ "$(echo "$CPU_USAGE >= $CPU_WARN" | bc -l)" -eq 1 ]; then
        echo "[WARNING] CPU usage is ${CPU_USAGE}%"
    else
        echo "[OK] CPU usage is ${CPU_USAGE}%"
    fi
}

check_ram() {
    RAM_TOTAL=$(free -m | awk 'NR==2 {print $2}')
    RAM_USED=$(free -m | awk 'NR==2 {print $3}')
    RAM_PERCENT=$((RAM_USED * 100 / RAM_TOTAL))

    echo "  RAM: ${RAM_USED}MB / ${RAM_TOTAL}MB (${RAM_PERCENT}%)"

    if [ "$RAM_PERCENT" -ge "$RAM_CRIT" ]; then
        echo "[CRITICAL] RAM usage is ${RAM_PERCENT}%"
        EXIT_CODE=1
    elif [ "$RAM_PERCENT" -ge "$RAM_WARN" ]; then
        echo "[WARNING] RAM usage is ${RAM_PERCENT}%"
    else
        echo "[OK] RAM usage is ${RAM_PERCENT}%"
    fi
}

check_disk() {
    while IFS= read -r line; do
        FILESYSTEM=$(echo "$line" | awk '{print $1}')
        SIZE=$(echo "$line" | awk '{print $2}')
        USED=$(echo "$line" | awk '{print $3}')
        AVAIL=$(echo "$line" | awk '{print $4}')
        PERCENT=$(echo "$line" | awk '{print $5}' | tr -d '%')
        MOUNT=$(echo "$line" | awk '{print $6}')

        echo "  $FILESYSTEM mounted on $MOUNT: $PERCENT% used ($USED / $SIZE)"

        if [ "$PERCENT" -ge "$DISK_CRIT" ]; then
            echo "[CRITICAL] Disk usage on $MOUNT is ${PERCENT}%"
            EXIT_CODE=1
        elif [ "$PERCENT" -ge "$DISK_WARN" ]; then
            echo "[WARNING] Disk usage on $MOUNT is ${PERCENT}%"
        else
            echo "[OK] Disk usage on $MOUNT is ${PERCENT}%"
        fi
    done < <(df -h | grep -v '^tmpfs\|^devtmpfs\|^Filesystem')
}

check_load() {
    LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk -F, '{print $1}' | tr -d ' ')
    echo "  System load: $LOAD"
}

echo "=== System Resource Check ==="
echo ""
check_cpu
echo ""
check_ram
echo ""
check_disk
echo ""
check_load

exit $EXIT_CODE
