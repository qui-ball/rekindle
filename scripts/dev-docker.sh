#!/bin/bash

# Unified Docker Development Server
# Handles both HTTP and HTTPS modes with a single script and Docker Compose file

set -e  # Exit on any error

# Parse arguments
HTTPS_MODE=false
SHOW_LOGS=true

for arg in "$@"; do
  case $arg in
    --https)
      HTTPS_MODE=true
      shift
      ;;
    --no-logs)
      SHOW_LOGS=false
      shift
      ;;
  esac
done

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Auto-handle .venv conflicts with fallback logic
if [ -d "backend/.venv" ]; then
    echo "⚠️  Local backend/.venv directory detected - attempting to use it..."
    echo "   If container startup fails, will automatically remove .venv and retry."
    echo ""
fi

# Function to get local IP
get_local_ip() {
    if command -v ifconfig &> /dev/null; then
        ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | sed 's/addr://'
    elif command -v ip &> /dev/null; then
        ip route get 1.1.1.1 | grep -oP 'src \K\S+'
    else
        echo "localhost"
    fi
}

LOCAL_IP=$(get_local_ip)

if [ "$HTTPS_MODE" = true ]; then
    echo "🔒 Starting Docker HTTPS Development Environment..."
    
    # Set up certificates if needed
    if [ ! -f "certs/cert.pem" ] || [ ! -f "certs/key.pem" ]; then
        echo "📜 Setting up HTTPS certificates..."
        ./scripts/setup-https-certs.sh
    else
        echo "✅ HTTPS certificates found"
    fi
    
    # Set environment variables for HTTPS mode
    export HTTPS_ENABLED=true
    export DOCKER_COMMAND="npm run dev:https"
    
    PROTOCOL="https"
    MODE_DESC="HTTPS (Mobile Camera Ready)"
else
    echo "🚀 Starting Docker HTTP Development Environment..."
    
    # Set environment variables for HTTP mode
    export HTTPS_ENABLED=false
    export DOCKER_COMMAND="npm run dev"
    
    PROTOCOL="http"
    MODE_DESC="HTTP (Standard Development)"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start containers with fallback logic
echo "🔨 Building and starting containers..."
if docker compose up --build -d; then
    echo "✅ Containers started successfully"
else
    echo "❌ Container startup failed"
    
    # Check if .venv exists and remove it, then retry
    if [ -d "backend/.venv" ]; then
        echo "🔄 Removing conflicting .venv directory and retrying..."
        rm -rf backend/.venv
        echo "🔄 Retrying container startup..."
        
        if docker compose up --build -d; then
            echo "✅ Containers started successfully after removing .venv"
        else
            echo "❌ Container startup failed even after removing .venv"
            echo "   Please check docker compose logs for details:"
            echo "   docker compose logs"
            exit 1
        fi
    else
        echo "❌ Container startup failed (no .venv to remove)"
        echo "   Please check docker compose logs for details:"
        echo "   docker compose logs"
        exit 1
    fi
fi

# Wait for containers to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if backend is healthy
echo "🔍 Checking backend health..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Backend may not be ready yet, but continuing..."
    fi
    sleep 1
done

# Setup database tables (only if a local postgres service exists)
if docker compose ps postgres >/dev/null 2>&1; then
    echo "🗄️  Setting up database tables..."
    docker compose exec -T postgres psql -U rekindle -d rekindle -c "
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    selected_restore_id UUID,
    latest_animation_id UUID
);

CREATE TABLE IF NOT EXISTS restore_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS animation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    restore_id UUID REFERENCES restore_attempts(id),
    preview_s3_key VARCHAR(500),
    result_s3_key VARCHAR(500),
    thumb_s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
" 2>/dev/null && echo "✅ Database tables ready" || echo "⚠️  Database tables may already exist"
else
    echo "ℹ️  Skipping DB bootstrap (no local postgres service; using external DB)"
fi

echo ""
echo "✅ Docker Development Environment Ready!"
echo ""
echo "🔧 Mode: $MODE_DESC"
echo "🔗 Access URLs:"
echo "   🏠 Frontend: $PROTOCOL://localhost:3000"
echo "   🌐 Frontend: $PROTOCOL://$LOCAL_IP:3000"
echo "   🔧 Backend:  http://localhost:8000"
echo "   📊 API Docs: http://localhost:8000/docs"
echo "   🌸 Flower:   http://localhost:5555 (Celery Monitor)"
echo ""

if [ "$HTTPS_MODE" = true ]; then
    echo "📱 Mobile Camera Testing:"
    echo "   1. Connect your mobile device to the same WiFi network"
    echo "   2. Open: https://$LOCAL_IP:3000"
    echo "   3. Accept the security certificate warning"
    echo "   4. Camera should work properly! 📷"
else
    echo "📱 Mobile Camera Testing:"
    echo "   ⚠️  HTTP mode - camera may not work on mobile devices"
    echo "   🔒 Use --https flag for mobile camera testing"
fi

echo ""
echo "🔧 Development Commands:"
echo "   View all logs:     docker compose logs -f"
echo "   View frontend:     docker compose logs -f frontend"
echo "   View backend:      docker compose logs -f backend"
echo "   View celery:       docker compose logs -f celery"
echo "   View flower:       docker compose logs -f flower"
echo "   Stop:              docker compose down"
echo "   Restart:           docker compose restart"
echo "   Frontend shell:    docker compose exec frontend sh"
echo "   Backend shell:     docker compose exec backend sh"
echo "   Celery shell:      docker compose exec celery sh"
echo ""

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Container logs (Ctrl+C to exit):"
    docker compose logs -f frontend backend celery
fi