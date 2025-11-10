#!/bin/bash

# HTTPS Certificate Setup for Docker Development
# This script creates certificates that work with Docker containers and mobile devices

set -e  # Exit on any error

# Create certs directory if it doesn't exist
mkdir -p certs

# Check if we have write permissions to the certs directory
if [ ! -w "certs" ]; then
    echo "❌ Permission error: Cannot write to certs directory!"
    echo ""
    echo "The certs directory exists but is owned by another user (likely root)."
    echo "Please fix the ownership by running:"
    echo "  sudo chown -R $USER:$USER certs"
    echo ""
    echo "Or remove the directory and let the script recreate it:"
    echo "  sudo rm -rf certs"
    echo ""
    exit 1
fi

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

# Install the local CA if not already installed (quiet unless error)
mkcert -install >/dev/null 2>&1 || mkcert -install

# Generate certificates for all required domains
cd certs

# Create certificates for localhost, local IP, and common Docker networking
# Quiet unless there's an error
if ! mkcert localhost 127.0.0.1 ::1 $LOCAL_IP host.docker.internal 0.0.0.0 >/dev/null 2>&1; then
    echo "❌ Certificate generation failed!"
    mkcert localhost 127.0.0.1 ::1 $LOCAL_IP host.docker.internal 0.0.0.0
    exit 1
fi

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