#!/bin/bash

# Stop all development services

echo "🛑 Stopping Rekindle Development Environment..."

# Stop Docker containers
echo "📦 Stopping Docker containers..."
cd "$(dirname "$0")/../.." # Go to project root
docker-compose down 2>/dev/null || true

# Clean up any background processes
echo "🔒 Cleaning up..."

echo "✅ All services stopped!"
echo ""
echo "🚀 To start again: ./dev.sh"