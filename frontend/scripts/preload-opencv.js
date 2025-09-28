#!/usr/bin/env node

/**
 * Script to preload OpenCV.js for development
 * This helps with faster development by pre-downloading the OpenCV.js library
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENCV_URL = 'https://docs.opencv.org/4.7.0/opencv.js';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OPENCV_PATH = path.join(PUBLIC_DIR, 'opencv.js');

console.log('🔄 Preloading OpenCV.js for development...');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Check if OpenCV.js already exists
if (fs.existsSync(OPENCV_PATH)) {
  console.log('✅ OpenCV.js already exists in public directory');
  process.exit(0);
}

// Download OpenCV.js
const file = fs.createWriteStream(OPENCV_PATH);

https.get(OPENCV_URL, (response) => {
  const totalSize = parseInt(response.headers['content-length'] || '0', 10);
  let downloadedSize = 0;

  response.on('data', (chunk) => {
    downloadedSize += chunk.length;
    const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
    process.stdout.write(`\r📥 Downloading OpenCV.js: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB)`);
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log('\n✅ OpenCV.js downloaded successfully!');
    console.log(`📁 Saved to: ${OPENCV_PATH}`);
    console.log('💡 You can now use OpenCV.js locally for faster development');
  });

  file.on('error', (err) => {
    fs.unlink(OPENCV_PATH, () => {}); // Delete the file on error
    console.error('\n❌ Error downloading OpenCV.js:', err.message);
    process.exit(1);
  });

}).on('error', (err) => {
  console.error('\n❌ Error downloading OpenCV.js:', err.message);
  process.exit(1);
});