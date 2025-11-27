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

# Load Google OAuth credentials from supabase/.env if it exists
OAUTH_ENV_FILE="$PROJECT_ROOT/supabase/.env"
if [ -f "$OAUTH_ENV_FILE" ]; then
    echo "🔐 Loading OAuth credentials from supabase/.env..."
    
    # Read credentials from file (POSIX-compliant, works with all shells)
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        case "$key" in
            \#*|'') continue ;;
        esac
        
        # Trim whitespace and quotes
        key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//')
        
        case "$key" in
            SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)
                export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="$value"
                ;;
            SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)
                export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="$value"
                ;;
        esac
    done < "$OAUTH_ENV_FILE"
    
    if [ -n "$SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID" ] && [ -n "$SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET" ]; then
        CLIENT_ID_PREVIEW=$(echo "$SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID" | cut -c1-30)
        echo "✅ OAuth credentials loaded (Client ID: ${CLIENT_ID_PREVIEW}...)"
    fi
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
    # New Supabase CLI uses top-level keys: ANON_KEY and SERVICE_ROLE_KEY
    # Use 'if .KEY then .KEY else empty end' to avoid jq outputting "null" as a string
    SUPABASE_ANON_KEY=$(supabase status --output json 2>/dev/null | jq -r 'if .ANON_KEY then .ANON_KEY elif .DB.APIKeys.anon then .DB.APIKeys.anon else empty end' 2>/dev/null || echo "")
    SUPABASE_SERVICE_KEY=$(supabase status --output json 2>/dev/null | jq -r 'if .SERVICE_ROLE_KEY then .SERVICE_ROLE_KEY elif .DB.APIKeys.service_role then .DB.APIKeys.service_role else empty end' 2>/dev/null || echo "")
    # Extract JWT_SECRET for HS256 token verification (local Supabase)
    SUPABASE_JWT_SECRET=$(supabase status --output json 2>/dev/null | jq -r '.JWT_SECRET' 2>/dev/null || echo "")
    
    # Filter out "null" strings that jq might output
    if [ "$SUPABASE_ANON_KEY" = "null" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        SUPABASE_ANON_KEY=""
    fi
    if [ "$SUPABASE_SERVICE_KEY" = "null" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        SUPABASE_SERVICE_KEY=""
    fi
    if [ "$SUPABASE_JWT_SECRET" = "null" ] || [ -z "$SUPABASE_JWT_SECRET" ]; then
        SUPABASE_JWT_SECRET=""
    fi
    
    # If still empty, try alternative paths
    if [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        # Fallback: parse from text output
        STATUS_OUTPUT=$(supabase status 2>/dev/null || echo "")
        if [ -z "$SUPABASE_ANON_KEY" ]; then
            SUPABASE_ANON_KEY=$(echo "$STATUS_OUTPUT" | grep -oP 'anon key:\s+\K[^\s]+' | head -1 || echo "")
        fi
        if [ -z "$SUPABASE_SERVICE_KEY" ]; then
            SUPABASE_SERVICE_KEY=$(echo "$STATUS_OUTPUT" | grep -oP 'service_role key:\s+\K[^\s]+' | head -1 || echo "")
        fi
    fi
else
    # Fallback: parse from text output
    # Handle both "anon key:" and "Publishable key:" formats
    STATUS_OUTPUT=$(supabase status 2>/dev/null || echo "")
    SUPABASE_ANON_KEY=$(echo "$STATUS_OUTPUT" | grep -oP '(?:anon key|Publishable key):\s+\K[^\s]+' | head -1 || echo "")
    SUPABASE_SERVICE_KEY=$(echo "$STATUS_OUTPUT" | grep -oP '(?:service_role key|Secret key):\s+\K[^\s]+' | head -1 || echo "")
    # JWT_SECRET is not available in text output, will need to be set manually or extracted from JSON
    SUPABASE_JWT_SECRET=""
fi

# Detect sed in-place syntax (macOS vs Linux)
if sed --version >/dev/null 2>&1; then
    # GNU sed (Linux)
    SED_INPLACE="sed -i"
else
    # BSD sed (macOS)
    SED_INPLACE="sed -i ''"
fi

# Update backend/.env file with Supabase credentials (source of truth)
# This ensures the .env file always has the correct values, even if docker-compose is run directly
# Only update if we successfully extracted non-empty, non-null values
if [ -n "$SUPABASE_ANON_KEY" ] && [ -n "$SUPABASE_SERVICE_KEY" ] && [ "$SUPABASE_ANON_KEY" != "null" ] && [ "$SUPABASE_SERVICE_KEY" != "null" ]; then
    # Update backend/.env with correct Supabase values
    if [ -f "backend/.env" ]; then
        # Use sed to update or add SUPABASE_URL
        if grep -q "^SUPABASE_URL=" backend/.env; then
            eval "$SED_INPLACE 's|^SUPABASE_URL=.*|SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS|' backend/.env"
        else
            echo "SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS" >> backend/.env
        fi
        # Update or add SUPABASE_ANON_KEY
        if grep -q "^SUPABASE_ANON_KEY=" backend/.env; then
            eval "$SED_INPLACE 's|^SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|' backend/.env"
        else
            echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> backend/.env
        fi
        # Update or add SUPABASE_SERVICE_KEY
        if grep -q "^SUPABASE_SERVICE_KEY=" backend/.env; then
            eval "$SED_INPLACE 's|^SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY|' backend/.env"
        else
            echo "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" >> backend/.env
        fi
    fi
    
    # Update frontend/.env.local with Supabase credentials (preferred over .env)
    if [ ! -f "frontend/.env.local" ]; then
        touch frontend/.env.local
    fi
    # Update or add NEXT_PUBLIC_SUPABASE_URL
    if grep -q "^NEXT_PUBLIC_SUPABASE_URL=" frontend/.env.local; then
        eval "$SED_INPLACE 's|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS|' frontend/.env.local"
    else
        echo "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS" >> frontend/.env.local
    fi
    # Update or add NEXT_PUBLIC_SUPABASE_ANON_KEY
    if grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" frontend/.env.local; then
        eval "$SED_INPLACE 's|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|' frontend/.env.local"
    else
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> frontend/.env.local
    fi
fi

# Export for potential use by docker-compose (though .env file is primary source)
export SUPABASE_URL="$SUPABASE_URL_FOR_CONTAINERS"
export SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
# Export JWT_SECRET for HS256 token verification (local Supabase)
if [ -n "$SUPABASE_JWT_SECRET" ]; then
    export SUPABASE_JWT_SECRET="$SUPABASE_JWT_SECRET"
fi

# Also set frontend environment variables (containers access via host.docker.internal)
# Note: These can be set in frontend/.env or frontend/.env.local, but script exports take precedence
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL_FOR_CONTAINERS"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

if [ -n "$SUPABASE_ANON_KEY" ] && [ -n "$SUPABASE_SERVICE_KEY" ]; then
    echo "✅ Supabase environment variables configured"
    echo "   API URL: $SUPABASE_URL"
    echo "   Studio URL: http://localhost:54323"
    if [ -n "$SUPABASE_JWT_SECRET" ]; then
        echo "   JWT Secret: ✅ Extracted (for HS256 token verification)"
    else
        echo "   JWT Secret: ⚠️  Not found (may need manual configuration)"
    fi
    echo ""
    echo "📝 Note: Frontend env vars are loaded from frontend/.env or frontend/.env.local"
    echo "   Script exports (above) will override file values if present"
else
    echo "⚠️  Could not extract Supabase keys automatically"
    echo "   You may need to set them manually in your .env files:"
    echo "   - backend/.env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET"
    echo "   - frontend/.env or frontend/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   Run 'supabase status --output json | jq .JWT_SECRET' to get JWT secret"
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

# Wait for frontend to be ready and warm up pages
echo "🔥 Warming up frontend pages..."
# Use -k flag for HTTPS to skip certificate verification in development
CURL_FLAGS="-s"
if [ "$HTTPS_MODE" = true ]; then
    CURL_FLAGS="-sk"
fi

for i in {1..30}; do
    if curl $CURL_FLAGS "$PROTOCOL://localhost:3000" > /dev/null 2>&1; then
        # Frontend is ready, now warm up main pages
        echo "   Pre-compiling pages..."
        # Warm up main pages in parallel (quietly)
        (
            curl $CURL_FLAGS "$PROTOCOL://localhost:3000" > /dev/null 2>&1 &
            curl $CURL_FLAGS "$PROTOCOL://localhost:3000/sign-in" > /dev/null 2>&1 &
            curl $CURL_FLAGS "$PROTOCOL://localhost:3000/sign-up" > /dev/null 2>&1 &
            curl $CURL_FLAGS "$PROTOCOL://localhost:3000/gallery" > /dev/null 2>&1 &
            curl $CURL_FLAGS "$PROTOCOL://localhost:3000/upload" > /dev/null 2>&1 &
            wait
        )
        echo "✅ Frontend warmed up"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Frontend may not be fully ready, but continuing..."
    fi
    sleep 1
done

# Apply database migrations (only if a local postgres service exists)
if docker compose ps postgres >/dev/null 2>&1; then
    echo "🗄️  Applying database migrations..."
    "$SCRIPT_DIR/apply-migrations.sh" || {
        echo "⚠️  Migration application had issues (this may be okay if migrations already applied)"
    }
fi

# Exit hook for clean shutdown / messaging
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "❌ Development environment encountered an error (exit code $exit_code)"
        echo "   Check docker compose logs for more details: docker compose logs"
    fi
    exit $exit_code
}

trap cleanup EXIT

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
echo "   Frontend shell:    docker compose exec frontend sh"
echo "   Backend shell:     docker compose exec backend sh"
echo "   Celery shell:      docker compose exec celery sh"
echo ""

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Following logs (Ctrl+C to exit)..."
    echo ""
    docker compose logs -f --tail=20 frontend backend
fi