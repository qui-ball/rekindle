#!/bin/bash

# HTTPS Development server for mobile camera testing

echo "🔒 Starting HTTPS Development Server..."

# Get the local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Check if we have certificates
if [ ! -f "localhost+1.pem" ] || [ ! -f "localhost+1-key.pem" ]; then
    echo "📜 Creating HTTPS certificates..."
    
    # Check if mkcert is installed
    if ! command -v mkcert &> /dev/null; then
        echo "Installing mkcert..."
        brew install mkcert
    fi
    
    # Install the local CA
    mkcert -install
    
    # Create certificates for localhost and local IP
    mkcert localhost ${LOCAL_IP}
fi

echo "✅ HTTPS certificates ready!"
echo ""

# Start Next.js with HTTPS using a custom server
cat > server-https.js << 'EOF'
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./localhost+1-key.pem'),
  cert: fs.readFileSync('./localhost+1.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on https://${hostname}:${port}`);
      console.log(`> Local: https://localhost:${port}`);
      console.log(`> Network: https://${LOCAL_IP}:${port}`);
    });
});
EOF

echo "🚀 Starting HTTPS server..."
echo ""
echo "📱 Access URLs:"
echo "   Local HTTPS:  https://localhost:3000"
echo "   Network HTTPS: https://${LOCAL_IP}:3000"
echo ""
echo "💡 For mobile camera testing:"
echo "   1. Use: https://${LOCAL_IP}:3000"
echo "   2. Accept the security warning (it's your local certificate)"
echo "   3. Camera should work properly with HTTPS!"
echo ""

# Start the HTTPS server
node server-https.js