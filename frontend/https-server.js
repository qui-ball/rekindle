const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
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
        console.log(`📜 Using certificates: ${certPath.cert}`);
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
      console.log('');
      console.log('🔒 HTTPS Development Server Ready!');
      console.log('');
      console.log(`📍 Server running on: https://${hostname}:${port}`);
      console.log(`🏠 Local access: https://localhost:${port}`);
      console.log(`🌐 Network access: https://${LOCAL_IP}:${port}`);
      console.log('');
      console.log('📱 Mobile Camera Testing:');
      console.log(`   1. Connect your mobile device to the same WiFi network`);
      console.log(`   2. Open: https://${LOCAL_IP}:${port}`);
      console.log(`   3. Accept the security certificate (it's locally trusted)`);
      console.log(`   4. Camera should work properly with HTTPS! 📷`);
      console.log('');
      console.log('🔧 Development:');
      console.log('   - Hot reload is enabled');
      console.log('   - Press Ctrl+C to stop');
      console.log('');
    });
});