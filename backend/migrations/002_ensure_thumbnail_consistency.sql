-- Migration: Ensure thumbnail consistency
-- Description: Add constraints and indexes to ensure thumbnail data consistency

-- Add NOT NULL constraint to thumbnail_s3_key for new records
-- (We'll handle existing NULL values in application code)
ALTER TABLE jobs ALTER COLUMN thumbnail_s3_key SET NOT NULL;

-- Add index for faster thumbnail lookups
CREATE INDEX IF NOT EXISTS idx_jobs_thumbnail_s3_key ON jobs(thumbnail_s3_key);

-- Add comment for documentation
COMMENT ON COLUMN jobs.thumbnail_s3_key IS 'S3 key path for thumbnail image stored in /thumbnails bucket. Must be set for all jobs.';

-- Add check constraint to ensure thumbnail_s3_key follows expected pattern
ALTER TABLE jobs ADD CONSTRAINT chk_thumbnail_s3_key_format 
CHECK (thumbnail_s3_key IS NULL OR thumbnail_s3_key LIKE 'thumbnails/%');
