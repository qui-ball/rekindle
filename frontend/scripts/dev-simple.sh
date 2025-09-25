#!/bin/bash

# Simple development startup script for Rekindle photo upload system

echo "🚀 Starting Rekindle Development Environment..."

# Parse command line arguments
HTTPS_MODE=false
for arg in "$@"; do
  case $arg in
    --https)
      HTTPS_MODE=true
      shift
      ;;
  esac
done

# Stop any existing containers
echo "🛑 Stopping existing containers..."
cd "$(dirname "$0")/../.." # Go to project root
docker-compose down

# Build and start the development environment
echo "🔨 Building and starting containers..."
docker-compose up --build -d

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to start..."
sleep 10

# Get the local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "📱 Access URLs:"
echo "   Local:    http://localhost:3000"
echo "   Network:  http://${LOCAL_IP}:3000"
echo ""

if [ "$HTTPS_MODE" = true ]; then
  echo "🔒 HTTPS Mode Enabled"
  echo ""
  echo "📱 For mobile camera testing with HTTPS:"
  echo "   1. Stop this script (Ctrl+C)"
  echo "   2. Run: cd frontend && ../scripts/dev-https.sh"
  echo "   3. Use the HTTPS URL on your mobile device"
  echo ""
else
  echo "📱 Mobile Camera Testing:"
  echo "   HTTP:  http://${LOCAL_IP}:3000 (may not work for camera)"
  echo "   HTTPS: Run './dev start --https' for mobile camera support"
  echo ""
fi

echo "🔧 Development Commands:"
echo "   View logs:     docker-compose logs -f frontend"
echo "   Stop:          docker-compose down"
echo "   Restart:       docker-compose restart frontend"
echo "   Shell access:  docker-compose exec frontend sh"
echo ""

# Show logs
echo "📋 Frontend logs (Ctrl+C to exit):"
docker-compose logs -f frontend