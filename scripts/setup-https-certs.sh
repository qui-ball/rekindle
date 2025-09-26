#!/bin/bash

# HTTPS Certificate Setup for Docker Development
# This script creates certificates that work with Docker containers and mobile devices

set -e  # Exit on any error

echo "🔒 Setting up HTTPS certificates for Docker development..."

# Create certs directory if it doesn't exist
mkdir -p certs

# Get the local IP address (works on macOS and Linux)
get_local_ip() {
    if command -v ifconfig &> /dev/null; then
        # macOS/Linux with ifconfig
        ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | sed 's/addr://'
    elif command -v ip &> /dev/null; then
        # Linux with ip command
        ip route get 1.1.1.1 | grep -oP 'src \K\S+'
    else
        echo "localhost"
    fi
}

LOCAL_IP=$(get_local_ip)
echo "📍 Detected local IP: $LOCAL_IP"

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed!"
    echo ""
    echo "Please install mkcert first:"
    echo "  macOS: brew install mkcert"
    echo "  Linux: See https://github.com/FiloSottile/mkcert#linux"
    echo "  Windows: choco install mkcert"
    echo ""
    exit 1
fi

# Install the local CA if not already installed
echo "🔐 Installing local CA..."
mkcert -install

# Generate certificates for all required domains
echo "📜 Generating certificates..."
cd certs

# Create certificates for localhost, local IP, and common Docker networking
mkcert \
    localhost \
    127.0.0.1 \
    ::1 \
    $LOCAL_IP \
    host.docker.internal \
    0.0.0.0

# Rename certificates to match our HTTPS server expectations
if [ -f "localhost+5.pem" ]; then
    cp "localhost+5.pem" "cert.pem"
    cp "localhost+5-key.pem" "key.pem"
elif [ -f "localhost+4.pem" ]; then
    cp "localhost+4.pem" "cert.pem"
    cp "localhost+4-key.pem" "key.pem"
elif [ -f "localhost+3.pem" ]; then
    cp "localhost+3.pem" "cert.pem"
    cp "localhost+3-key.pem" "key.pem"
else
    echo "❌ Certificate generation failed!"
    exit 1
fi

cd ..

echo "✅ HTTPS certificates created successfully!"
echo ""
echo "📋 Certificate files created:"
echo "   certs/cert.pem"
echo "   certs/key.pem"
echo ""
echo "🌐 These certificates are valid for:"
echo "   - https://localhost:3000"
echo "   - https://127.0.0.1:3000"
echo "   - https://$LOCAL_IP:3000"
echo "   - Docker internal networking"
echo ""
echo "📱 For mobile testing, use: https://$LOCAL_IP:3000"