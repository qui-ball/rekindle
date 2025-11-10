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

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed!"
    echo ""
    echo "Please install it using one of the following:"
    echo "  macOS:   brew install supabase/tap/supabase"
    echo "  Linux:   See https://supabase.com/docs/guides/cli/getting-started"
    echo "  Windows: See https://supabase.com/docs/guides/cli/getting-started"
    echo ""
    echo "Or visit: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

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

# Start Supabase if not already running
echo "🔐 Starting Supabase..."
if supabase status >/dev/null 2>&1; then
    echo "✅ Supabase is already running"
else
    echo "🚀 Starting local Supabase instance..."
    SUPABASE_OUTPUT=$(supabase start 2>&1)
    if [ $? -ne 0 ]; then
        echo "❌ Failed to start Supabase"
        echo "$SUPABASE_OUTPUT"
        exit 1
    fi
    echo "✅ Supabase started successfully"
fi

# Wait for Supabase to be ready
echo "⏳ Waiting for Supabase to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Supabase may not be fully ready, but continuing..."
    fi
    sleep 1
done

# Extract Supabase credentials and set environment variables
# Use host.docker.internal for containers to access host services
SUPABASE_URL="http://localhost:54321"
SUPABASE_URL_FOR_CONTAINERS="http://host.docker.internal:54321"

# Try to extract keys from supabase status output
# First try JSON output, then fallback to parsing text output
if command -v jq &> /dev/null && supabase status --output json >/dev/null 2>&1; then
    SUPABASE_ANON_KEY=$(supabase status --output json 2>/dev/null | jq -r '.DB.APIKeys.anon' 2>/dev/null || echo "")
    SUPABASE_SERVICE_KEY=$(supabase status --output json 2>/dev/null | jq -r '.DB.APIKeys.service_role' 2>/dev/null || echo "")
else
    # Fallback: parse from text output
    STATUS_OUTPUT=$(supabase status 2>/dev/null || echo "")
    SUPABASE_ANON_KEY=$(echo "$STATUS_OUTPUT" | grep -oP 'anon key:\s+\K[^\s]+' | head -1 || echo "")
    SUPABASE_SERVICE_KEY=$(echo "$STATUS_OUTPUT" | grep -oP 'service_role key:\s+\K[^\s]+' | head -1 || echo "")
fi

# Export Supabase environment variables for use in Docker containers
# These will override values in env_file if the script successfully extracted them
export SUPABASE_URL="$SUPABASE_URL_FOR_CONTAINERS"
export SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"

# Also set frontend environment variables (containers access via host.docker.internal)
# Note: These can be set in frontend/.env or frontend/.env.local, but script exports take precedence
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL_FOR_CONTAINERS"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

if [ -n "$SUPABASE_ANON_KEY" ] && [ -n "$SUPABASE_SERVICE_KEY" ]; then
    echo "✅ Supabase environment variables configured"
    echo "   API URL: $SUPABASE_URL"
    echo "   Studio URL: http://localhost:54323"
    echo ""
    echo "📝 Note: Frontend env vars are loaded from frontend/.env or frontend/.env.local"
    echo "   Script exports (above) will override file values if present"
else
    echo "⚠️  Could not extract Supabase keys automatically"
    echo "   You may need to set them manually in your .env files:"
    echo "   - backend/.env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY"
    echo "   - frontend/.env or frontend/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   Run 'supabase status' to see the keys"
fi

# Ensure frontend .env files exist (Docker Compose requires them)
# Priority: .env.local > .env
if [ ! -f "frontend/.env.local" ] && [ -f "frontend/.env" ]; then
    echo "📝 Copying frontend/.env to frontend/.env.local..."
    cp frontend/.env frontend/.env.local
elif [ ! -f "frontend/.env.local" ] && [ ! -f "frontend/.env" ]; then
    echo "⚠️  No frontend/.env or frontend/.env.local found - creating empty .env.local"
    touch frontend/.env.local
fi
# Ensure .env exists (even if empty) for Docker Compose compatibility
if [ ! -f "frontend/.env" ]; then
    touch frontend/.env
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
echo "🔐 Supabase Services:"
echo "   API URL:    http://localhost:54321"
echo "   Studio URL: http://localhost:54323"
echo ""
echo "🔧 Development Commands:"
echo "   View all logs:     docker compose logs -f"
echo "   View frontend:     docker compose logs -f frontend"
echo "   View backend:      docker compose logs -f backend"
echo "   View celery:       docker compose logs -f celery"
echo "   View flower:       docker compose logs -f flower"
echo "   Stop:              ./dev stop"
echo "   Restart:           docker compose restart"
echo "   Frontend shell:   docker compose exec frontend sh"
echo "   Backend shell:     docker compose exec backend sh"
echo "   Celery shell:      docker compose exec celery sh"
echo ""

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Following logs (Ctrl+C to exit)..."
    echo ""
    docker compose logs -f --tail=20 frontend backend
fi