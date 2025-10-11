#!/bin/bash

# Full Cleanup Script - Database + S3
# Clears all data for fresh start

set -e

echo "🧹 Full Cleanup: Database + S3 Storage"
echo "======================================"
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Step 1: Database cleanup
echo "Step 1: Database Cleanup"
echo "------------------------"
cd backend && python3 ../scripts/cleanup-database.py
cd ..

echo ""
echo "======================================"
echo ""

# Step 2: S3 cleanup
echo "Step 2: S3 Storage Cleanup"
echo "------------------------"
python3 scripts/cleanup-s3.py

echo ""
echo "======================================"
echo "✅ Full cleanup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Open http://localhost:3000/camera"
echo "  2. Take or upload a photo"
echo "  3. Go to http://localhost:3000/gallery"
echo "  4. See the thumbnail in action!"
echo ""
echo "🔍 Monitor thumbnail generation:"
echo "  docker-compose logs -f backend | grep -i thumbnail"
echo ""

