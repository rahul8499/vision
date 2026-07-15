#!/bin/bash
# ============================================================
# AARX Platform - Daily Startup Script
# Run: bash start.sh
# ============================================================

echo "🚀 Starting AARX Platform..."

# 1. Database
echo "📦 Starting PostgreSQL & PgBouncer..."
sudo systemctl start postgresql
sudo systemctl start pgbouncer
echo "✅ Database started!"

# Redis is the Celery broker used by background push-notification tasks.
echo "🧰 Starting Redis..."
sudo systemctl start redis-server
echo "✅ Redis started!"

# 2. Django Backend
echo "🐍 Starting Django Backend (port 8000)..."
cd /home/rahulkolhe/Desktop/backup/vision/django
source venv/bin/activate
gnome-terminal --title="Django Backend" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/django && source venv/bin/activate && uvicorn aarx.asgi:application --host 0.0.0.0 --port 8000 --reload; exec bash"

# 3. AI Service
echo "🤖 Starting AI Service (port 8010)..."
gnome-terminal --title="AI Service" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/ai_service && source venv/bin/activate && AI_TIMEOUT_SECONDS=21 uvicorn main:app --host 0.0.0.0 --port 8010 --reload; exec bash"

# 4. Celery worker for chat and other background push notifications
echo "🔔 Starting Celery notification worker..."
gnome-terminal --title="AARX Notification Worker" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/django && source venv/bin/activate && celery -A aarx worker -l info -Q notifications,default --concurrency=4; exec bash"

# 5. Expo Dev Client
echo "📱 Starting Expo Metro Bundler..."
gnome-terminal --title="Expo Dev Client" -- bash -c "cd /home/rahulkolhe/Desktop/backup/vision/AARXUI && npx expo start --dev-client; exec bash"

# 6. Wait for phone to connect, then ADB reverse
echo ""
echo "🔌 Connect your phone via USB, then run:"
echo "   adb reverse tcp:8000 tcp:8000"
echo ""
echo "✅ All services started! Open AARX Dev Client app on your phone."
