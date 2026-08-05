#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Checking Django production settings import..."
cd "$ROOT_DIR/django"
DJANGO_SETTINGS_MODULE=aarx.settings_production ./venv2/bin/python manage.py check --deploy

echo "Checking Support Web production build..."
cd "$ROOT_DIR/support-web"
npm run build

echo "Production checks completed."
