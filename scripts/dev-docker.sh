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
    echo "⚠️  Local .venv detected - will auto-remove if needed"
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

# Export host IP for use in Docker containers (especially for mobile access)
export HOST_IP="$LOCAL_IP"

if [ "$HTTPS_MODE" = true ]; then
    echo "🔒 Starting HTTPS Development Environment..."
    
    # Set up certificates if needed
    if [ ! -f "certs/cert.pem" ] || [ ! -f "certs/key.pem" ]; then
        echo "📜 Setting up certificates..."
        ./scripts/setup-https-certs.sh 2>/dev/null || {
            # If silent mode fails, try verbose
            ./scripts/setup-https-certs.sh
        }
    fi
    
    # Set environment variables for HTTPS mode
    export HTTPS_ENABLED=true
    export DOCKER_COMMAND="npm run dev:https"
    
    PROTOCOL="https"
    MODE_DESC="HTTPS (Mobile Camera Ready)"
else
    echo "🚀 Starting Development Environment..."
    
    # Set environment variables for HTTP mode
    export HTTPS_ENABLED=false
    export DOCKER_COMMAND="npm run dev"
    
    PROTOCOL="http"
    MODE_DESC="HTTP (Standard Development)"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose down >/dev/null 2>&1 || true

# Build and start containers with fallback logic
echo "🔨 Building and starting containers..."
if docker compose up --build -d --quiet-pull >/dev/null 2>&1; then
    echo "✅ Containers started successfully"
else
    echo "❌ Container startup failed"
    
    # Check if .venv exists and remove it, then retry
    if [ -d "backend/.venv" ]; then
        echo "🔄 Removing conflicting .venv directory and retrying..."
        rm -rf backend/.venv
        echo "🔄 Retrying container startup..."
        
        if docker compose up --build -d --quiet-pull >/dev/null 2>&1; then
            echo "✅ Containers started successfully after removing .venv"
        else
            echo "❌ Container startup failed even after removing .venv"
            echo "   Run 'docker compose logs' for details"
            exit 1
        fi
    else
        echo "❌ Container startup failed"
        echo "   Run 'docker compose logs' for details"
        exit 1
    fi
fi

# Wait for containers to be ready
echo "⏳ Waiting for services..."
sleep 8

# Check if backend is healthy (quietly)
for i in {1..20}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Setup database tables (only if a local postgres service exists)
if docker compose ps postgres >/dev/null 2>&1; then
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
" >/dev/null 2>&1 || true
fi

echo ""
echo "✅ Development Environment Ready!"
echo ""
echo "🔗 Access: $PROTOCOL://localhost:3000"
if [ "$HTTPS_MODE" = true ]; then
    echo "📱 Mobile: https://$LOCAL_IP:3000 (same WiFi network)"
fi
echo ""
echo "💡 Quick commands:"
echo "   Logs:    docker compose logs -f [service]"
echo "   Stop:    docker compose down"
echo ""

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Following logs (Ctrl+C to exit)..."
    echo ""
    docker compose logs -f --tail=20 frontend backend
fi