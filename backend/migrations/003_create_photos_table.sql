-- Migration: Create photos table for per-user storage isolation
-- Date: 2025-11-11
-- Description: Introduces photos table with owner-scoped constraints and metadata

-- Ensure pgcrypto is available for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id VARCHAR(255) NOT NULL,
    original_key TEXT NOT NULL,
    processed_key TEXT,
    thumbnail_key TEXT,
    storage_bucket TEXT NOT NULL DEFAULT 'rekindle-uploads',
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    size_bytes BIGINT,
    mime_type VARCHAR(100),
    checksum_sha256 CHAR(64) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_photos_valid_status
        CHECK (status IN ('uploaded', 'processing', 'ready', 'archived', 'deleted'))
);

-- Ensure owner and original key pairs remain unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_owner_original_key
    ON photos(owner_id, original_key);

-- Optimize lookups by owner and by status
CREATE INDEX IF NOT EXISTS idx_photos_owner_id
    ON photos(owner_id);

CREATE INDEX IF NOT EXISTS idx_photos_status
    ON photos(status);

COMMENT ON TABLE photos IS 'Stores photo metadata scoped to each authenticated user.';
COMMENT ON COLUMN photos.owner_id IS 'Supabase user identifier (sub) that owns the photo.';
COMMENT ON COLUMN photos.original_key IS 'S3 object key for the original uploaded asset.';
COMMENT ON COLUMN photos.processed_key IS 'S3 object key for the processed/restored asset.';
COMMENT ON COLUMN photos.thumbnail_key IS 'S3 object key for the thumbnail asset.';


