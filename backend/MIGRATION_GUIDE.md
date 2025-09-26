# Migration Guide: New Job-Based Architecture

## Overview

This guide explains how to migrate from the old `restoration_jobs` table to the new job-based architecture with separate tables for jobs, restore attempts, and animation attempts.

## New Architecture

### Database Schema

1. **`jobs`** - Main job table (user upload session)
2. **`restore_attempts`** - Each restoration attempt on a job
3. **`animation_attempts`** - Each animation of a restored image

### S3 Structure

```
s3://rekindle-media/
├── processed/<job_id>.<ext>                    # Cropped/preprocessed input
├── restored/<job_id>/<restore_id>.jpg          # Each restore attempt
├── animated/<job_id>/<animation_id>_preview.mp4 # Free preview (low-res + WM)
├── animated/<job_id>/<animation_id>_result.mp4  # Paid HD version
├── thumbnails/<job_id>/<animation_id>.jpg      # Animation thumbnail
└── meta/<job_id>.json                          # Optional metadata cache
```

## Migration Steps

### 1. Set Environment Variables

Add to your `.env` file:
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_BUCKET=rekindle-media
CLOUDFRONT_DOMAIN=your-domain.cloudfront.net
```

### 2. Run Database Migration

```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration script
\i migrations/create_new_schema.sql
```

### 3. Update API Endpoints

The new API endpoints are:

- **POST** `/api/v1/jobs/upload` - Upload image and create job
- **POST** `/api/v1/jobs/{job_id}/restore` - Create restore attempt
- **POST** `/api/v1/jobs/{job_id}/animate` - Create animation attempt
- **GET** `/api/v1/jobs/{job_id}` - Get job with all attempts
- **GET** `/api/v1/jobs` - List jobs (with email filter)
- **DELETE** `/api/v1/jobs/{job_id}` - Delete job and all data

### 4. Worker Tasks

New Celery tasks:
- `process_restoration` - Process image restoration
- `process_animation` - Create animation from restored image
- `generate_hd_result` - Generate HD/paid version
- `cleanup_job_s3_files` - Clean up S3 files for deleted job

## API Usage Examples

### Upload Image
```bash
curl -X POST "http://localhost:8000/api/v1/jobs/upload" \
  -F "file=@photo.jpg" \
  -F "email=user@example.com"
```

### Create Restore Attempt
```bash
curl -X POST "http://localhost:8000/api/v1/jobs/{job_id}/restore" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "comfyui_v2",
    "params": {"denoise": 0.7, "megapixels": 1.0}
  }'
```

### Create Animation
```bash
curl -X POST "http://localhost:8000/api/v1/jobs/{job_id}/animate" \
  -H "Content-Type: application/json" \
  -d '{
    "restore_id": "{restore_id}",
    "model": "animation_v1",
    "params": {"duration": 3}
  }'
```

### Get Job Details
```bash
curl "http://localhost:8000/api/v1/jobs/{job_id}"
```

## Data Migration (Optional)

If you have existing data in `restoration_jobs` table, uncomment and modify the migration section in `migrations/create_new_schema.sql`:

```sql
-- Migrate existing jobs
INSERT INTO jobs (id, email, created_at)
SELECT 
  id,
  user_id as email,
  created_at
FROM restoration_jobs;

-- Migrate as restore attempts
INSERT INTO restore_attempts (job_id, s3_key, created_at)
SELECT 
  id as job_id,
  processed_image_url as s3_key,
  updated_at as created_at
FROM restoration_jobs
WHERE processed_image_url IS NOT NULL;
```

## Testing

Run the tests to ensure everything works:

```bash
# Run all tests
uv run pytest

# Run specific test files
uv run pytest tests/api/test_jobs.py
uv run pytest tests/services/test_s3.py
```

## Rollback Plan

If you need to rollback:

1. Keep the old `restoration_jobs` table intact during migration
2. The old endpoints are still available at `/api/v1/restoration/`
3. To fully rollback, drop the new tables:
   ```sql
   DROP TABLE IF EXISTS animation_attempts CASCADE;
   DROP TABLE IF EXISTS restore_attempts CASCADE;
   DROP TABLE IF EXISTS jobs CASCADE;
   ```

## Notes

- The database is the source of truth; S3 just stores blobs
- Jobs cascade delete to all related attempts
- CloudFront URLs are generated dynamically from S3 keys
- Worker tasks update the database upon completion