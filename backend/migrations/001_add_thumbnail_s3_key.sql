-- Migration: Add thumbnail_s3_key to jobs table
-- Date: 2025-10-10
-- Description: Add thumbnail_s3_key column to store S3 thumbnail paths for performance optimization

-- Add thumbnail_s3_key column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS thumbnail_s3_key VARCHAR;

-- Add comment for documentation
COMMENT ON COLUMN jobs.thumbnail_s3_key IS 'S3 key path for thumbnail image stored in /thumbnails bucket';

-- Create index for faster lookups if needed
CREATE INDEX IF NOT EXISTS idx_jobs_thumbnail_s3_key ON jobs(thumbnail_s3_key);

