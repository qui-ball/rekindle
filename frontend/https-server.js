const { createServer } = require('https');
const http = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Get local IP address
// Excludes Docker network interfaces (docker0, br-*, and 172.x.x.x private networks)
function getLocalIP() {
  // Check if host IP is provided via environment variable (set by dev-docker.sh)
  if (process.env.HOST_IP && process.env.HOST_IP !== 'localhost') {
    return process.env.HOST_IP;
  }
  
  const interfaces = os.networkInterfaces();
  const dockerInterfaces = ['docker0', 'br-'];
  const dockerIPRanges = ['172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];
  
  for (const name of Object.keys(interfaces)) {
    // Skip Docker interfaces
    if (dockerInterfaces.some(prefix => name.startsWith(prefix))) {
      continue;
    }
    
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        // Skip Docker IP ranges (172.17.0.0/12)
        if (!dockerIPRanges.some(range => interface.address.startsWith(range))) {
          return interface.address;
        }
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Try multiple certificate locations for flexibility
function loadCertificates() {
  const certPaths = [
    // New trusted certificates (created with mkcert)
    { key: './certs/localhost+3-key.pem', cert: './certs/localhost+3.pem' },
    // Docker mounted certificates
    { key: './certs/key.pem', cert: './certs/cert.pem' },
    // Legacy certificates
    { key: './localhost+3-key.pem', cert: './localhost+3.pem' },
    { key: './localhost+1-key.pem', cert: './localhost+1.pem' },
  ];

  for (const certPath of certPaths) {
    try {
      if (fs.existsSync(certPath.key) && fs.existsSync(certPath.cert)) {
        return {
          key: fs.readFileSync(certPath.key),
          cert: fs.readFileSync(certPath.cert),
        };
      }
    } catch (error) {
      console.warn(`Failed to load certificates from ${certPath.cert}:`, error.message);
    }
  }

  throw new Error('No valid HTTPS certificates found! Please run: npm run setup:certs');
}

const httpsOptions = loadCertificates();

// Wait for Next.js to be ready and ensure initial compilation is complete
app.prepare().then(async () => {
  // In development mode, wait a bit longer to ensure initial compilation is complete
  // This prevents the "Invalid or unexpected token" error on first load
  if (dev) {
    console.log('⏳ Waiting for initial compilation to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    console.log('✅ Ready to serve requests');
  }

  // Create HTTPS server
  const httpsServer = createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      // API requests are handled by Next.js API routes in src/app/api/[...path]/route.ts
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error('HTTPS Server Error:', err);
      if (err.code === 'ENOENT') {
        console.error('');
        console.error('❌ Certificate files not found!');
        console.error('Please run: npm run setup:certs');
        console.error('');
      }
      process.exit(1);
    })
    .listen(port, hostname, () => {
      // Quiet startup - main info shown by dev-docker.sh
    });

}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err);
  process.exit(1);
});