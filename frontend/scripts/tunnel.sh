#!/bin/bash

# HTTPS Tunnel setup for mobile camera testing

echo "🔒 Setting up HTTPS tunnel for mobile camera testing..."

# Check if ssh is available
if ! command -v ssh &> /dev/null; then
    echo "❌ SSH not found. This is required for the tunnel."
    exit 1
fi

# Check if development server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Development server is not running on port 3000"
    echo "Please start the development environment first:"
    echo "   ./dev start"
    exit 1
fi

echo "🌐 Starting HTTPS tunnel..."
echo ""
echo "📱 This will create an HTTPS URL you can use on mobile devices"
echo "   for testing camera functionality"
echo ""
echo "💡 No passwords or setup required!"
echo "⏳ Serveo will assign a random HTTPS URL..."
echo ""

# Start serveo tunnel (let serveo assign random subdomain)
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 serveo.net