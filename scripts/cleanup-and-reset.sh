#!/bin/bash

# Cleanup and Reset Script
# Clears database and S3 storage for fresh start

set -e  # Exit on error

echo "🧹 Starting cleanup and reset process..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is running
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  Docker services not running. Starting them...${NC}"
    docker-compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 5
fi

echo -e "${YELLOW}📊 Current database status:${NC}"
docker-compose exec postgres psql -U rekindle -d rekindle -c "
SELECT 
    'jobs' as table_name, COUNT(*) as record_count FROM jobs
UNION ALL
SELECT 
    'restore_attempts' as table_name, COUNT(*) as record_count FROM restore_attempts
UNION ALL
SELECT 
    'animation_attempts' as table_name, COUNT(*) as record_count FROM animation_attempts;
"

echo ""
read -p "⚠️  This will DELETE ALL data. Continue? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Cleaning up database...${NC}"
docker-compose exec postgres psql -U rekindle -d rekindle -c "
TRUNCATE jobs, restore_attempts, animation_attempts CASCADE;
"
echo "✅ Database cleared"

echo ""
echo -e "${GREEN}Step 2: Applying thumbnail migration...${NC}"
docker-compose exec postgres psql -U rekindle -d rekindle -f /app/migrations/001_add_thumbnail_s3_key.sql || {
    echo -e "${YELLOW}⚠️  Migration may have already been applied (this is okay)${NC}"
}
echo "✅ Migration applied"

echo ""
echo -e "${GREEN}Step 3: Cleaning up S3 storage...${NC}"

# Get AWS credentials from .env or environment
if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$S3_BUCKET" ]; then
    echo -e "${YELLOW}⚠️  AWS credentials not found in environment${NC}"
    echo "Skipping S3 cleanup. You'll need to manually delete files from S3 bucket."
    echo ""
    echo "Manual cleanup commands:"
    echo "  aws s3 rm s3://\$S3_BUCKET/uploaded/ --recursive"
    echo "  aws s3 rm s3://\$S3_BUCKET/thumbnails/ --recursive"
    echo "  aws s3 rm s3://\$S3_BUCKET/restored/ --recursive"
    echo "  aws s3 rm s3://\$S3_BUCKET/animated/ --recursive"
else
    echo "Bucket: $S3_BUCKET"
    echo "Cleaning /uploaded folder..."
    aws s3 rm s3://$S3_BUCKET/uploaded/ --recursive 2>/dev/null || echo "  (folder may be empty)"
    
    echo "Cleaning /thumbnails folder..."
    aws s3 rm s3://$S3_BUCKET/thumbnails/ --recursive 2>/dev/null || echo "  (folder may be empty)"
    
    echo "Cleaning /restored folder..."
    aws s3 rm s3://$S3_BUCKET/restored/ --recursive 2>/dev/null || echo "  (folder may be empty)"
    
    echo "Cleaning /animated folder..."
    aws s3 rm s3://$S3_BUCKET/animated/ --recursive 2>/dev/null || echo "  (folder may be empty)"
    
    echo "✅ S3 storage cleaned"
fi

echo ""
echo -e "${GREEN}Step 4: Verifying cleanup...${NC}"
docker-compose exec postgres psql -U rekindle -d rekindle -c "
SELECT 
    'jobs' as table_name, COUNT(*) as record_count FROM jobs
UNION ALL
SELECT 
    'restore_attempts' as table_name, COUNT(*) as record_count FROM restore_attempts
UNION ALL
SELECT 
    'animation_attempts' as table_name, COUNT(*) as record_count FROM animation_attempts;
"

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Open the app: http://localhost:3000"
echo "  2. Go to the camera page and take a photo"
echo "  3. The thumbnail will be automatically generated"
echo "  4. Check the gallery to see the thumbnail in action"
echo ""
echo "🔍 To monitor thumbnail generation:"
echo "  docker-compose logs -f backend | grep -i thumbnail"
echo ""

