#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
need() { command -v "$1" >/dev/null || { echo "Missing: $1" >&2; exit 1; }; }
need python3.12
need npm
need redis-cli
[[ -f "$ROOT_DIR/django/.env" ]] || { echo "Create django/.env from django/.env.example" >&2; exit 1; }
[[ -f "$ROOT_DIR/AARXUI/.env" ]] || { echo "Create AARXUI/.env from AARXUI/.env.example" >&2; exit 1; }
[[ -f "$ROOT_DIR/AARXUI/google-services.json" ]] || { echo "Missing AARXUI/google-services.json" >&2; exit 1; }
python3.12 -m venv "$ROOT_DIR/django/venv2"
"$ROOT_DIR/django/venv2/bin/pip" install --upgrade pip
"$ROOT_DIR/django/venv2/bin/pip" install -r "$ROOT_DIR/django/requirements.txt"
python3.12 -m venv "$ROOT_DIR/ai_service/venv"
"$ROOT_DIR/ai_service/venv/bin/pip" install --upgrade pip
"$ROOT_DIR/ai_service/venv/bin/pip" install -r "$ROOT_DIR/ai_service/requirements.txt"
(cd "$ROOT_DIR/AARXUI" && npm ci)
"$ROOT_DIR/django/venv2/bin/python" "$ROOT_DIR/django/manage.py" check
"$ROOT_DIR/django/venv2/bin/python" "$ROOT_DIR/django/manage.py" migrate --noinput
echo "Bootstrap complete. Start infra services, then run ./start.sh"
