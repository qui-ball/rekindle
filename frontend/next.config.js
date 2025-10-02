const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable PWA in development to avoid GenerateSW warnings
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
    // Cache OpenCV.js for offline use
    {
      urlPattern: /.*opencv\.js$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'opencv-cache',
        expiration: {
          maxEntries: 1,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable SWC compiler to avoid Alpine Linux compatibility issues
  swcMinify: false,
  compiler: {
    // Force use of Babel instead of SWC
    removeConsole: false,
  },
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // Webpack configuration for JScanify and OpenCV.js
  webpack: (config, { isServer, dev }) => {
    // Don't bundle JScanify on the server side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('jscanify');
    }

    // Handle Node.js modules that JScanify tries to import
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      net: false,
      tls: false,
      child_process: false,
      'http-proxy-agent': false,
      'https-proxy-agent': false,
      'agent-base': false,
    };

    // Only externalize JScanify's Node.js dependencies in production builds
    // In development, let webpack handle the bundling for better error messages
    if (!isServer && !dev) {
      config.externals = config.externals || [];
      config.externals.push({
        'jsdom': 'commonjs jsdom',
        'canvas': 'commonjs canvas',
      });
    }

    return config;
  },
  // Proxy API requests to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*'
      }
    ];
  },

  // Enable camera access for PWA and configure headers for OpenCV.js
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, geolocation=*'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          },
          // Allow loading OpenCV.js from CDN
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://docs.opencv.org https://cdn.jsdelivr.net;"
          }
        ]
      }
    ];
  }
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));