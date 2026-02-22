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

# Function to get Windows host IP for mobile access (WSL2)
# This gets the actual Windows machine IP that mobile devices can access
get_windows_host_ip() {
    local ip=""
    
    # Method 1: Use ipconfig.exe to get Windows network adapter IP
    if command -v ipconfig.exe &> /dev/null; then
        # Get all IPv4 addresses and prioritize real network IPs
        # Filter out WSL2 gateway IPs (172.18.x.x, 172.17.x.x) and prefer 192.168.x.x, 10.x.x.x
        local all_ips=$(ipconfig.exe 2>/dev/null | grep -i "IPv4" | sed 's/.*: *//' | tr -d '\r\n' | xargs)
        
        # First, try to find 192.168.x.x (most common home network)
        ip=$(echo "$all_ips" | tr ' ' '\n' | grep -E "^192\.168\." | head -1)
        
        # If no 192.168, try 10.x.x.x (but not 10.255.x.x which is WSL2 virtual)
        if [ -z "$ip" ]; then
            ip=$(echo "$all_ips" | tr ' ' '\n' | grep -E "^10\." | grep -v "^10\.255\." | head -1)
        fi
        
        # If still no good IP, get any that's not WSL2/Docker range
        if [ -z "$ip" ]; then
            ip=$(echo "$all_ips" | tr ' ' '\n' | grep -v "^127\." | grep -v "^172\.1[7-9]\." | grep -v "^172\.2[0-9]\." | grep -v "^172\.3[0-1]\." | head -1)
        fi
        
        # Validate it's a real IP (not empty, not localhost, looks like an IP)
        if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ] && [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "$ip"
            return
        fi
    fi
    
    # Method 2: Try to get from WSL2 /etc/resolv.conf (but filter out virtual IPs)
    if [ -f /etc/resolv.conf ]; then
        ip=$(grep nameserver /etc/resolv.conf | awk '{print $2}' | head -1 | xargs)
        # Filter out WSL2 virtual IPs (10.255.x.x) and Docker IPs
        if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ] && [[ ! "$ip" =~ ^10\.255\. ]] && [[ ! "$ip" =~ ^172\.(1[7-9]|2[0-9]|3[0-1])\. ]]; then
            echo "$ip"
            return
        fi
    fi
    
    # Return empty if we can't find a good IP
    echo ""
}

# Function to get local IP (exclude Docker networks)
get_local_ip() {
    # For WSL2, prioritize Windows host IP
    local windows_ip=$(get_windows_host_ip)
    if [ -n "$windows_ip" ]; then
        echo "$windows_ip"
        return
    fi
    
    # Fallback: Try to get from network interfaces
    local ip=""
    if command -v hostname &> /dev/null; then
        ip=$(hostname -I 2>/dev/null | awk '{
            for(i=1;i<=NF;i++) {
                # Skip loopback, Docker networks, and WSL2 virtual IPs (10.255.x.x)
                if($i!~/^127\./ && $i!~/^172\.(1[7-9]|2[0-9]|3[0-1])\./ && $i!~/^10\.255\./) {
                    print $i
                    exit
                }
            }
        }')
        if [ -n "$ip" ]; then
            echo "$ip"
            return
        fi
    fi
    
    # If we can't find a good IP, return empty
    echo ""
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

# Function to extract JSON value without jq (using grep/sed)
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed -n 's/.*"\([^"]*\)"/\1/p' | head -1
}

# Try to extract keys from supabase status output
# First try JSON output (with or without jq), then fallback to parsing text output
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_KEY=""
SUPABASE_JWT_SECRET=""

if supabase status --output json >/dev/null 2>&1; then
    JSON_OUTPUT=$(supabase status --output json 2>/dev/null || echo "")
    
    if command -v jq &> /dev/null; then
        # Use jq if available (most reliable)
        SUPABASE_ANON_KEY=$(echo "$JSON_OUTPUT" | jq -r 'if .ANON_KEY then .ANON_KEY elif .DB.APIKeys.anon then .DB.APIKeys.anon else empty end' 2>/dev/null || echo "")
        SUPABASE_SERVICE_KEY=$(echo "$JSON_OUTPUT" | jq -r 'if .SERVICE_ROLE_KEY then .SERVICE_ROLE_KEY elif .DB.APIKeys.service_role then .DB.APIKeys.service_role else empty end' 2>/dev/null || echo "")
        SUPABASE_JWT_SECRET=$(echo "$JSON_OUTPUT" | jq -r '.JWT_SECRET // empty' 2>/dev/null || echo "")
    else
        # Fallback: parse JSON without jq using grep/sed
        SUPABASE_ANON_KEY=$(extract_json_value "$JSON_OUTPUT" "ANON_KEY")
        if [ -z "$SUPABASE_ANON_KEY" ]; then
            SUPABASE_ANON_KEY=$(extract_json_value "$JSON_OUTPUT" "anon")
        fi
        SUPABASE_SERVICE_KEY=$(extract_json_value "$JSON_OUTPUT" "SERVICE_ROLE_KEY")
        if [ -z "$SUPABASE_SERVICE_KEY" ]; then
            SUPABASE_SERVICE_KEY=$(extract_json_value "$JSON_OUTPUT" "service_role")
        fi
        SUPABASE_JWT_SECRET=$(extract_json_value "$JSON_OUTPUT" "JWT_SECRET")
    fi
    
    # Filter out "null" strings
    if [ "$SUPABASE_ANON_KEY" = "null" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        SUPABASE_ANON_KEY=""
    fi
    if [ "$SUPABASE_SERVICE_KEY" = "null" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        SUPABASE_SERVICE_KEY=""
    fi
    if [ "$SUPABASE_JWT_SECRET" = "null" ] || [ -z "$SUPABASE_JWT_SECRET" ]; then
        SUPABASE_JWT_SECRET=""
    fi
fi

# If extraction failed, try parsing text output
if [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    STATUS_OUTPUT=$(supabase status 2>/dev/null || echo "")
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        SUPABASE_ANON_KEY=$(echo "$STATUS_OUTPUT" | grep -oP '(?:anon key|Publishable key):\s+\K[^\s]+' | head -1 || echo "")
    fi
    if [ -z "$SUPABASE_SERVICE_KEY" ]; then
        SUPABASE_SERVICE_KEY=$(echo "$STATUS_OUTPUT" | grep -oP '(?:service_role key|Secret key):\s+\K[^\s]+' | head -1 || echo "")
    fi
fi

# Load from .env files if extraction failed
if [ -z "$SUPABASE_ANON_KEY" ] && [ -f "backend/.env" ]; then
    SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" backend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
fi
if [ -z "$SUPABASE_SERVICE_KEY" ] && [ -f "backend/.env" ]; then
    SUPABASE_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_KEY=" backend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
fi
if [ -z "$SUPABASE_JWT_SECRET" ] && [ -f "backend/.env" ]; then
    SUPABASE_JWT_SECRET=$(grep "^SUPABASE_JWT_SECRET=" backend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
fi

# Update backend/.env file with Supabase credentials (source of truth)
# This ensures the .env file always has the correct values, even if docker-compose is run directly
# Always ensure SUPABASE_URL is set correctly, and update keys if we extracted them
if [ -f "backend/.env" ]; then
    # Always update SUPABASE_URL to use host.docker.internal for containers
    if grep -q "^SUPABASE_URL=" backend/.env; then
        sed -i "s|^SUPABASE_URL=.*|SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS|" backend/.env
    else
        echo "SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS" >> backend/.env
    fi
    
    # Only update keys if we successfully extracted them
    if [ -n "$SUPABASE_ANON_KEY" ] && [ -n "$SUPABASE_SERVICE_KEY" ] && [ "$SUPABASE_ANON_KEY" != "null" ] && [ "$SUPABASE_SERVICE_KEY" != "null" ]; then
        # Update or add SUPABASE_ANON_KEY
        if grep -q "^SUPABASE_ANON_KEY=" backend/.env; then
            sed -i "s|^SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" backend/.env
        else
            echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> backend/.env
        fi
        # Update or add SUPABASE_SERVICE_KEY
        if grep -q "^SUPABASE_SERVICE_KEY=" backend/.env; then
            sed -i "s|^SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY|" backend/.env
        else
            echo "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" >> backend/.env
        fi
        # Update or add SUPABASE_JWT_SECRET if we have it
        if [ -n "$SUPABASE_JWT_SECRET" ] && [ "$SUPABASE_JWT_SECRET" != "null" ]; then
            if grep -q "^SUPABASE_JWT_SECRET=" backend/.env; then
                sed -i "s|^SUPABASE_JWT_SECRET=.*|SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET|" backend/.env
            else
                echo "SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET" >> backend/.env
            fi
        fi
    fi
fi

# Update frontend/.env.local with Supabase credentials (preferred over .env)
if [ ! -f "frontend/.env.local" ]; then
    touch frontend/.env.local
fi
# Always ensure URL is set correctly
if grep -q "^NEXT_PUBLIC_SUPABASE_URL=" frontend/.env.local; then
    sed -i "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS|" frontend/.env.local
else
    echo "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_FOR_CONTAINERS" >> frontend/.env.local
fi
# Only update ANON_KEY if we extracted it
if [ -n "$SUPABASE_ANON_KEY" ] && [ "$SUPABASE_ANON_KEY" != "null" ]; then
    if grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" frontend/.env.local; then
        sed -i "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" frontend/.env.local
    else
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> frontend/.env.local
    fi
fi

# Check if keys exist in .env files (for better error messages)
HAS_BACKEND_ENV_KEYS=false
HAS_FRONTEND_ENV_KEYS=false

if [ -f "backend/.env" ]; then
    if grep -q "^SUPABASE_ANON_KEY=" backend/.env && grep -q "^SUPABASE_SERVICE_KEY=" backend/.env; then
        HAS_BACKEND_ENV_KEYS=true
    fi
fi

if [ -f "frontend/.env.local" ] || [ -f "frontend/.env" ]; then
    if [ -f "frontend/.env.local" ] && grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" frontend/.env.local; then
        HAS_FRONTEND_ENV_KEYS=true
    elif [ -f "frontend/.env" ] && grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" frontend/.env; then
        HAS_FRONTEND_ENV_KEYS=true
    fi
fi

# Export for potential use by docker-compose (though .env file is primary source)
# Only export if we have values (either extracted or from .env files)
if [ -n "$SUPABASE_ANON_KEY" ] && [ -n "$SUPABASE_SERVICE_KEY" ]; then
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
    
    echo "✅ Supabase environment variables configured"
    if [ -n "$SUPABASE_JWT_SECRET" ]; then
        echo "   JWT Secret: ✅ Extracted (for HS256 token verification)"
    elif [ "$HAS_BACKEND_ENV_KEYS" = true ]; then
        echo "   JWT Secret: ℹ️  Check backend/.env for SUPABASE_JWT_SECRET"
    else
        echo "   JWT Secret: ⚠️  Not found (may need manual configuration)"
    fi
    echo ""
    echo "📝 Note: Frontend env vars are loaded from frontend/.env or frontend/.env.local"
    echo "   Script exports (above) will override file values if present"
elif [ "$HAS_BACKEND_ENV_KEYS" = true ] && [ "$HAS_FRONTEND_ENV_KEYS" = true ]; then
    # Keys exist in .env files, so load them for exports
    if [ -f "backend/.env" ]; then
        export SUPABASE_URL="$SUPABASE_URL_FOR_CONTAINERS"
        export SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" backend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
        export SUPABASE_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_KEY=" backend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
        if grep -q "^SUPABASE_JWT_SECRET=" backend/.env; then
            export SUPABASE_JWT_SECRET=$(grep "^SUPABASE_JWT_SECRET=" backend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
        fi
    fi
    
    # Load frontend keys
    # Always use container-accessible URL (host.docker.internal) for Docker
    export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL_FOR_CONTAINERS"
    if [ -f "frontend/.env.local" ]; then
        export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" frontend/.env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
    elif [ -f "frontend/.env" ]; then
        export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" frontend/.env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
    fi
    
    echo "✅ Supabase environment variables loaded from .env files"
    echo "   API URL: $SUPABASE_URL_FOR_CONTAINERS"
    echo "   Studio URL: http://localhost:54323"
else
    echo "⚠️  Could not extract Supabase keys automatically and .env files are missing keys"
    echo "   Please set them manually in your .env files:"
    echo "   - backend/.env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET"
    echo "   - frontend/.env or frontend/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   Run 'supabase status --output json' to get values (install jq for easier parsing)"
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

# Check if a port is in use (Linux/WSL: ss or netstat). Returns 0 if in use.
port_in_use() {
    local port="$1"
    if command -v ss &>/dev/null; then
        ss -tuln 2>/dev/null | grep -qE ":$port\s"
        return $?
    fi
    if command -v netstat &>/dev/null; then
        netstat -tuln 2>/dev/null | grep -q ":$port "
        return $?
    fi
    # Fallback: try to connect (bash)
    if (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
        return 0
    fi
    return 1
}

# Ensure required ports are free: stop containers, wait for release, then verify
ensure_ports_free() {
    local required_ports="3000 8000"
    echo "🛑 Stopping existing containers..."
    docker compose down -t 5 >/dev/null 2>&1 || true
    echo "   Waiting for ports to be released..."
    sleep 3
    for port in $required_ports; do
        if port_in_use "$port"; then
            echo ""
            echo "❌ Port $port is still in use after stopping containers."
            echo "   To see what is using it:"
            if command -v ss &>/dev/null; then
                echo "   ss -tulnp | grep :$port"
            elif command -v netstat &>/dev/null; then
                echo "   netstat -tulnp | grep $port"
            fi
            echo "   Then run: ./dev stop  (or kill that process) and try again."
            echo ""
            return 1
        fi
    done
    return 0
}

if ! ensure_ports_free; then
    exit 1
fi

# Build and start containers with fallback logic
echo "🔨 Building and starting containers..."
echo "   (This may take a few minutes on first build...)"
echo ""

# Try to start containers - hide verbose output, only show errors
# Capture output to a temp file for error reporting
TEMP_LOG=$(mktemp)
set +e  # Don't exit on error, we'll check the exit code manually
# Run docker compose and capture exit code separately to avoid SIGPIPE issues
docker compose up --build -d > "$TEMP_LOG" 2>&1
BUILD_EXIT_CODE=$?
# Show filtered output (errors and key status messages)
grep -E "(ERROR|error|failed|Failed|Building|Creating|Starting|Pulling|Step|#)" "$TEMP_LOG" | head -20 || true
set -e  # Re-enable exit on error

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Containers started successfully"
    rm -f "$TEMP_LOG" 2>/dev/null
else
    echo ""
    echo "❌ Container startup failed (exit code: $BUILD_EXIT_CODE)"
    echo ""
    echo "📋 Error details:"
    tail -50 "$TEMP_LOG" 2>/dev/null | grep -E "(ERROR|error|failed|Failed)" | tail -20 || tail -30 "$TEMP_LOG" 2>/dev/null || echo "   Check 'docker compose logs' for details"
    echo ""

    # If failure was due to port already allocated, retry once after aggressive teardown
    PORT_CONFLICT=$(grep -E "port is already allocated|Bind for .* (3000|8000) failed" "$TEMP_LOG" 2>/dev/null || true)
    if [ -n "$PORT_CONFLICT" ]; then
        echo "🔄 Port conflict detected. Stopping containers and waiting for ports to release..."
        docker compose down -t 5 >/dev/null 2>&1 || true
        sleep 5
        echo "🔄 Retrying container startup..."
        echo ""
        RETRY_LOG=$(mktemp)
        set +e
        docker compose up --build -d > "$RETRY_LOG" 2>&1
        RETRY_EXIT_CODE=$?
        grep -E "(ERROR|error|failed|Failed|Building|Creating|Starting)" "$RETRY_LOG" | head -20 || true
        set -e
        if [ $RETRY_EXIT_CODE -eq 0 ]; then
            echo ""
            echo "✅ Containers started successfully on retry"
            rm -f "$TEMP_LOG" "$RETRY_LOG" 2>/dev/null
            BUILD_EXIT_CODE=0
        else
            echo ""
            echo "❌ Retry failed (exit code: $RETRY_EXIT_CODE)"
            echo ""
            echo "💡 Port 8000 or 3000 is in use. Try:"
            echo "   1. Run: ./dev stop   then wait 5 seconds and run ./dev https again"
            echo "   2. Or find and stop the process: ss -tulnp | grep -E ':3000|:8000'"
            rm -f "$TEMP_LOG" "$RETRY_LOG" 2>/dev/null
            exit 1
        fi
    fi

    # If we recovered from port conflict, skip the .venv retry and failure handling below
    if [ $BUILD_EXIT_CODE -eq 0 ]; then
        true
    # Check if .venv exists and remove it, then retry
    elif [ -d "backend/.venv" ]; then
        echo "🔄 Removing conflicting .venv directory and retrying..."
        rm -rf backend/.venv
        echo "🔄 Retrying container startup..."
        echo ""
        
        RETRY_LOG=$(mktemp)
        set +e
        # Run docker compose and capture exit code separately to avoid SIGPIPE issues
        docker compose up --build -d > "$RETRY_LOG" 2>&1
        RETRY_EXIT_CODE=$?
        # Show filtered output (errors and key status messages)
        grep -E "(ERROR|error|failed|Failed|Building|Creating|Starting|Pulling|Step|#)" "$RETRY_LOG" | head -20 || true
        set -e
        if [ $RETRY_EXIT_CODE -eq 0 ]; then
            echo ""
            echo "✅ Containers started successfully after removing .venv"
            rm -f "$RETRY_LOG" 2>/dev/null
        else
            echo ""
            echo "❌ Container startup failed even after removing .venv (exit code: $RETRY_EXIT_CODE)"
            echo ""
            echo "📋 Error details:"
            tail -30 "$RETRY_LOG" 2>/dev/null || echo "   Check 'docker compose logs' for details"
            echo ""
            echo "💡 Troubleshooting tips:"
            echo "   1. Check Docker is running: docker ps"
            echo "   2. View detailed logs: docker compose logs"
            echo "   3. Check for port conflicts: netstat -tuln | grep -E ':(3000|8000|5432|6379)'"
            echo "   4. Verify .env files have required variables"
            rm -f "$RETRY_LOG" 2>/dev/null
            exit 1
        fi
    else
        echo "💡 Troubleshooting tips:"
        echo "   1. Check Docker is running: docker ps"
        echo "   2. View detailed logs: docker compose logs"
        echo "   3. Check for port conflicts: netstat -tuln | grep -E ':(3000|8000|5432|6379)'"
        echo "   4. Verify .env files have required variables"
        rm -f "$TEMP_LOG" 2>/dev/null
        exit 1
    fi
    rm -f "$TEMP_LOG" 2>/dev/null
fi

# Verify containers are actually running
echo "⏳ Waiting for containers to start..."
sleep 3

# Check container status
CONTAINER_STATUS=$(docker compose ps --format json 2>/dev/null | head -1 || echo "")
if [ -z "$CONTAINER_STATUS" ]; then
    echo "❌ No containers found running!"
    echo "   Checking logs for errors..."
    docker compose logs --tail=50 2>&1 | grep -i error | head -10 || echo "   Run 'docker compose logs' for full details"
    exit 1
fi

# Wait for containers to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check backend status (quietly)
BACKEND_READY=false
for i in {1..30}; do
    if docker compose ps backend 2>/dev/null | grep -q "Up"; then
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            BACKEND_READY=true
            break
        fi
    fi
    sleep 1
done

# Check frontend status (quietly)
# Use -k flag for HTTPS to skip certificate verification in development
CURL_FLAGS="-s"
if [ "$HTTPS_MODE" = true ]; then
    CURL_FLAGS="-sk"
fi

FRONTEND_READY=false
for i in {1..40}; do
    if docker compose ps frontend 2>/dev/null | grep -q "Up"; then
        if curl $CURL_FLAGS "$PROTOCOL://localhost:3000" > /dev/null 2>&1; then
            FRONTEND_READY=true
            # Warm up main pages in parallel (quietly)
            (
                curl $CURL_FLAGS "$PROTOCOL://localhost:3000" > /dev/null 2>&1 &
                curl $CURL_FLAGS "$PROTOCOL://localhost:3000/sign-in" > /dev/null 2>&1 &
                curl $CURL_FLAGS "$PROTOCOL://localhost:3000/sign-up" > /dev/null 2>&1 &
                curl $CURL_FLAGS "$PROTOCOL://localhost:3000/gallery" > /dev/null 2>&1 &
                curl $CURL_FLAGS "$PROTOCOL://localhost:3000/upload" > /dev/null 2>&1 &
                wait
            ) > /dev/null 2>&1
            break
        fi
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
    if [ -n "$LOCAL_IP" ] && [ "$LOCAL_IP" != "localhost" ]; then
        echo "📱 Mobile: https://$LOCAL_IP:3000"
        echo "   (Use this URL on your mobile device - same WiFi network required)"
    else
        echo "📱 Mobile: Unable to auto-detect Windows host IP"
        echo ""
        echo "   To find your Windows host IP:"
        echo "   1. Open PowerShell or CMD on Windows"
        echo "   2. Run: ipconfig"
        echo "   3. Find 'IPv4 Address' under 'Wireless LAN adapter Wi-Fi' or 'Ethernet adapter'"
        echo "   4. Use: https://YOUR_WINDOWS_IP:3000"
    fi
    echo ""
    echo "   Troubleshooting:"
    echo "   - Ensure mobile device is on the same WiFi network"
    echo "   - Windows Firewall: Allow port 3000 (or temporarily disable firewall to test)"
    echo "   - If still not working, check Windows network adapter IP manually"
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
echo "   Stop:              ./dev stop"
echo ""

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Following logs (Ctrl+C to exit)..."
    echo ""
    docker compose logs -f --tail=20 frontend backend
fi