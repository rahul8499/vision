#!/bin/bash
# ============================================================
# AARX Platform - PRODUCTION Load Test Startup Script
# Run: bash start_prod.sh
# Purpose: Simulates massive user load handling using Gunicorn Workers.
# ============================================================

echo "🚀 Starting AARX Platform in HIGH-PERFORMANCE Mode..."

# 1. Database & Cache
echo "📦 Starting PostgreSQL, PgBouncer & Redis..."
sudo systemctl start postgresql
sudo systemctl start pgbouncer
sudo systemctl start redis-server 2>/dev/null
echo "✅ Infrastructure started!"

# 2. Django Backend (Gunicorn for high concurrency)
echo "🐍 Starting Django Backend (Gunicorn - 4 Workers)..."
cd /home/rahulkolhe/Desktop/backup/vision/django
source venv/bin/activate
# Using gunicorn with Uvicorn worker class for async support and high throughput
gnome-terminal --title="Django Prod Server" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/django && source venv/bin/activate && pip install gunicorn uvloop httptools websockets 2>/dev/null; gunicorn aarx.asgi:application -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120; exec bash"

# 3. AI Service (Gunicorn for high concurrency)
echo "🤖 Starting AI Service (Gunicorn - 2 Workers)..."
gnome-terminal --title="AI Prod Service" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/ai_service && source venv/bin/activate && pip install gunicorn 2>/dev/null; AI_TIMEOUT_SECONDS=21 gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8010 --timeout 120; exec bash"

# 4. Celery Worker for Background Tasks (Optional but good for Payments)
echo "⚡ Starting Celery Task Workers..."
gnome-terminal --title="Celery Workers" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/django && source venv/bin/activate && celery -A aarx worker -l info --concurrency=4; exec bash"

# 5. Expo Dev Client
echo "📱 Starting Expo Metro Bundler..."
gnome-terminal --title="Expo Dev Client" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/AARXUI && npx expo start --dev-client; exec bash"

echo ""
echo "🔥 AARX is now running with Gunicorn, Uvicorn Workers, and Celery!"
echo "This setup can handle thousands of concurrent requests."
echo "Connect your phone, run 'adb reverse tcp:8000 tcp:8000' and test it out!"
