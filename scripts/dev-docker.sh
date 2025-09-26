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
docker-compose down 2>/dev/null || true

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose up --build -d

# Wait for container to be ready
echo "⏳ Waiting for server to start..."
sleep 5

echo ""
echo "✅ Docker Development Environment Ready!"
echo ""
echo "🔧 Mode: $MODE_DESC"
echo "🔗 Access URLs:"
echo "   🏠 Local:   $PROTOCOL://localhost:3000"
echo "   🌐 Network: $PROTOCOL://$LOCAL_IP:3000"
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
echo "   View logs:     docker-compose logs -f"
echo "   Stop:          docker-compose down"
echo "   Restart:       docker-compose restart"
echo "   Shell access:  docker-compose exec frontend sh"
echo ""

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Container logs (Ctrl+C to exit):"
    docker-compose logs -f frontend
fi