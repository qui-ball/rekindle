const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Enable PWA in development for testing
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
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // Webpack configuration for JScanify and OpenCV.js
  webpack: (config, { isServer }) => {
    // Don't bundle OpenCV.js on the server side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('jscanify');
    }

    // Handle large dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
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