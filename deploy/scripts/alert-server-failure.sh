#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AARX Platform - Server Failure Alerting (Hindi)
# सर्वर डाउन या रीसोर्स खत्म होने पर alert यहाँ से भेजे जाता है
# ============================================================

ALERT_WEBHOOK_URL="<alert-webhook-url>"
ALERT_EMAIL="rahulkolhe90.rk.rk@gmail.com"
HOSTNAME=$(hostname)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')

send_webhook_alert() {
    local message="$1"
    local severity="$2"

    if [ -z "$ALERT_WEBHOOK_URL" ] || [ "$ALERT_WEBHOOK_URL" = "<alert-webhook-url>" ]; then
        return 0
    fi

    curl -s -X POST "$ALERT_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"[${severity}] ${HOSTNAME}: ${message}\",
            \"host\": \"${HOSTNAME}\",
            \"timestamp\": \"${TIMESTAMP}\",
            \"severity\": \"${severity}\"
        }" >/dev/null 2>&1 || true
}

send_email_alert() {
    local subject="$1"
    local body="$2"

    if [ -z "$ALERT_EMAIL" ] || [ "$ALERT_EMAIL" = "<alert-email>" ]; then
        return 0
    fi

    if command -v mail >/dev/null 2>&1; then
        echo "$body" | mail -s "[AARX Alert] $subject" "$ALERT_EMAIL" || true
    elif command -v sendmail >/dev/null 2>&1; then
        echo -e "Subject: [AARX Alert] $subject\n\n$body" | sendmail "$ALERT_EMAIL" || true
    fi
}

alert_critical() {
    local message="$1"
    echo "[अलर्ट] बहुत-ज़रूरी: $message"
    send_webhook_alert "$message" "CRITICAL"
    send_email_alert "$message" "सर्वर: $HOSTNAME\nसमय: $TIMESTAMP\nसमस्या: $message\nगंभीरता: बहुत-ज़रूरी"
}

alert_warning() {
    local message="$1"
    echo "[अलर्ट] चेतावनी: $message"
    send_webhook_alert "$message" "WARNING"
    send_email_alert "$message" "सर्वर: $HOSTNAME\nसमय: $TIMESTAMP\nसमस्या: $message\nगंभीरता: चेतावनी"
}

check_service_status() {
    local service_name="$1"
    local unit_name="$2"

    if systemctl is-active --quiet "$unit_name" 2>/dev/null; then
        echo "[ठीक] $service_name चल रहा है"
    else
        alert_critical "$service_name डाउन है"
        return 1
    fi
}

echo "=== सर्वर स्वास्थ्य अलर्ट जाँच ==="
echo "होस्ट: $HOSTNAME"
echo "समय: $TIMESTAMP"
echo ""

FAILED=0

check_service_status "Django ASGI" "aarx-asgi" || FAILED=1
check_service_status "Celery Worker" "aarx-celery" || FAILED=1
check_service_status "Celery Beat" "aarx-celery-beat" || FAILED=1
check_service_status "Nginx" "nginx" || FAILED=1
check_service_status "PostgreSQL" "postgresql" || FAILED=1
check_service_status "Redis" "redis-server" || FAILED=1

DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
    alert_critical "डिस्क उपयोग बहुत-ज़रूरी: ${DISK_USAGE}%"
    FAILED=1
elif [ "$DISK_USAGE" -gt 75 ]; then
    alert_warning "डिस्क उपयोग अधिक: ${DISK_USAGE}%"
fi

RAM_PERCENT=$(free | awk 'NR==2 {printf "%.0f", $3/$2*100}')
if [ "$RAM_PERCENT" -gt 95 ]; then
    alert_critical "RAM उपयोग बहुत-ज़रूरी: ${RAM_PERCENT}%"
    FAILED=1
elif [ "$RAM_PERCENT" -gt 80 ]; then
    alert_warning "RAM उपयोग अधिक: ${RAM_PERCENT}%"
fi

if [ "$FAILED" -eq 0 ]; then
    echo ""
    echo "सभी जाँचें पार हुईं।"
else
    echo ""
    echo "एक या अधिक जाँचें में विफलता हुई। अलर्ट भेजा गया है।"
    exit 1
fi
