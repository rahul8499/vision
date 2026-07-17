#!/usr/bin/env bash
set -Eeuo pipefail

# AARX local development launcher.
# Starts PostgreSQL, PgBouncer, Redis, Django/Channels, AI, Celery and Expo.

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DJANGO_DIR="$ROOT_DIR/django"
AI_DIR="$ROOT_DIR/ai_service"
EXPO_DIR="$ROOT_DIR/AARXUI"
DJANGO_VENV="${DJANGO_VENV:-$DJANGO_DIR/venv2}"
AI_VENV="${AI_VENV:-$AI_DIR/venv}"

info() { printf '\n\033[1;34m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m%s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

require_file() {
  [[ -e "$1" ]] || fail "Missing required file: $1"
}

service_exists() {
  systemctl list-unit-files "$1.service" --no-legend 2>/dev/null | grep -q "^$1.service"
}

start_system_service() {
  local service="$1"
  service_exists "$service" || fail "Required system service is not installed: $service"
  if systemctl is-active --quiet "$service"; then
    ok "✓ $service already running"
  else
    sudo systemctl start "$service"
    systemctl is-active --quiet "$service" || fail "$service failed to start"
    ok "✓ $service started"
  fi
}

port_is_open() {
  (echo >/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1
}

wait_for_port() {
  local name="$1" port="$2" attempts="${3:-30}"
  for ((i = 1; i <= attempts; i++)); do
    if port_is_open "$port"; then
      ok "✓ $name ready on port $port"
      return 0
    fi
    sleep 1
  done
  fail "$name did not become ready on port $port"
}

launch_terminal() {
  local title="$1" command="$2"
  gnome-terminal --title="$title" -- bash -lc "$command"
}

require_file "$DJANGO_VENV/bin/python"
require_file "$DJANGO_VENV/bin/uvicorn"
require_file "$DJANGO_VENV/bin/celery"
require_file "$AI_VENV/bin/uvicorn"
command -v gnome-terminal >/dev/null || fail "gnome-terminal is required"
command -v npm >/dev/null || fail "npm is required for Expo"

info "Starting AARX infrastructure"
start_system_service postgresql
start_system_service pgbouncer
start_system_service redis-server

redis-cli -h 127.0.0.1 -p 6379 ping | grep -qx PONG ||
  fail "Redis started but did not respond to PING"
wait_for_port "PgBouncer" 6432 15

info "Checking Django and applying pending migrations"
(
  cd "$DJANGO_DIR"
  "$DJANGO_VENV/bin/python" -c "import channels_redis, celery, uvicorn, websockets, whitenoise, corsheaders, django_filters, django_celery_results, psycopg2, geopy, geohash, razorpay, httpx" ||
    fail "Django venv dependencies are incomplete; run: $DJANGO_VENV/bin/pip install -r $DJANGO_DIR/requirements.txt"
  "$DJANGO_VENV/bin/python" manage.py check
  "$DJANGO_VENV/bin/python" manage.py migrate --noinput
)

info "Starting application processes"
if port_is_open 8000; then
  ok "✓ Django already running on port 8000"
else
  launch_terminal "AARX Django + WebSocket" \
    "cd '$DJANGO_DIR' && exec '$DJANGO_VENV/bin/uvicorn' aarx.asgi:application --host 0.0.0.0 --port 8000 --reload"
  wait_for_port "Django + WebSocket" 8000 30
fi

if port_is_open 8010; then
  ok "✓ AI service already running on port 8010"
else
  launch_terminal "AARX AI Classifier" \
    "cd '$AI_DIR' && AI_TIMEOUT_SECONDS=21 exec '$AI_VENV/bin/uvicorn' main:app --host 0.0.0.0 --port 8010 --reload"
  wait_for_port "AI classifier" 8010 45
fi

if pgrep -f "celery .*[-]A aarx worker" >/dev/null; then
  ok "✓ Celery worker already running"
else
  launch_terminal "AARX Celery Worker" \
    "cd '$DJANGO_DIR' && exec '$DJANGO_VENV/bin/celery' -A aarx worker -l info -Q notifications,default --concurrency=4"
  sleep 2
  pgrep -f "celery .*[-]A aarx worker" >/dev/null ||
    fail "Celery worker failed to start; check its terminal"
  ok "✓ Celery worker started"
fi

if pgrep -f "expo start.*--dev-client" >/dev/null; then
  ok "✓ Expo Metro already running"
else
  launch_terminal "AARX Expo Dev Client" \
    "cd '$EXPO_DIR' && exec npx expo start --dev-client"
  ok "✓ Expo Metro launch requested"
fi

if command -v adb >/dev/null && adb get-state >/dev/null 2>&1; then
  adb reverse tcp:8000 tcp:8000
  ok "✓ Android USB reverse configured for port 8000"
else
  printf '\nConnect an Android phone, then run: adb reverse tcp:8000 tcp:8000\n'
fi

info "All required AARX services are running"
printf '%s\n' \
  "Django API + WebSocket : http://127.0.0.1:8000" \
  "AI classifier          : http://127.0.0.1:8010" \
  "Redis / Celery broker  : redis://127.0.0.1:6379/0" \
  "PgBouncer              : 127.0.0.1:6432"
