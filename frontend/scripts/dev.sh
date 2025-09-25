#!/bin/bash

# Development startup script for Rekindle photo upload system

echo "🚀 Starting Rekindle Development Environment..."

# Parse command line arguments
SKIP_TUNNEL=false
for arg in "$@"; do
  case $arg in
    --no-tunnel)
      SKIP_TUNNEL=true
      shift
      ;;
  esac
done

# Stop any existing containers
echo "🛑 Stopping existing containers..."
cd "$(dirname "$0")/../.." # Go to project root
docker-compose down

# Kill any existing tunnel processes
pkill -f "ssh.*serveo.net" || true

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

# Set up HTTPS for mobile testing unless skipped
if [ "$SKIP_TUNNEL" = false ]; then
  echo "🔒 Setting up HTTPS tunnel for mobile camera testing..."
  
  # Check if ssh is available (should be on macOS by default)
  if ! command -v ssh &> /dev/null; then
    echo "❌ SSH not found. This is required for the tunnel."
    echo "   Or run: ./dev start --no-tunnel to skip tunnel setup"
    SKIP_TUNNEL=true
  fi
  
  if [ "$SKIP_TUNNEL" = false ]; then
    # Generate a random subdomain
    SUBDOMAIN="rekindle-$(openssl rand -hex 4)"
    
    # Set up HTTPS certificates if they don't exist
    if [ ! -f "frontend/localhost+3.pem" ] || [ ! -f "frontend/localhost+3-key.pem" ]; then
      echo "🔒 Setting up HTTPS certificates..."
      cd frontend
      mkcert localhost ${LOCAL_IP} 127.0.0.1 ::1
      cd ..
    fi
    
    echo "🎉 HTTPS Development Server ready!"
    echo ""
    echo "📱 Mobile Camera Testing:"
    echo "   Use: https://${LOCAL_IP}:3000 on your mobile device"
    echo "   Camera will work because this uses trusted HTTPS certificates"
    echo ""
    echo "💡 No external services, tunnels, or authentication required!"
    
    echo ""
    echo "🔧 Development Commands:"
    echo "   View logs:     docker-compose logs -f frontend"
    echo "   Stop all:      docker-compose down && pkill -f 'ssh.*serveo.net'"
    echo "   Restart:       docker-compose restart frontend"
    echo "   Shell access:  docker-compose exec frontend sh"
    echo ""
  fi
else
  echo "🔧 Development Commands:"
  echo "   View logs:     docker-compose logs -f frontend"
  echo "   Stop:          docker-compose down"
  echo "   Restart:       docker-compose restart frontend"
  echo "   Shell access:  docker-compose exec frontend sh"
  echo "   Start tunnel:  ./tunnel.sh"
  echo ""
  echo "📱 Mobile Testing:"
  echo "   HTTP:  http://${LOCAL_IP}:3000"
  echo "   HTTPS: Run ./tunnel.sh for camera features"
  echo ""
fi

# Show logs
echo "📋 Frontend logs (Ctrl+C to exit, tunnel will keep running):"
docker-compose logs -f frontend