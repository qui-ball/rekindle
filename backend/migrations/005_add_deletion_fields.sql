-- Migration: Add deletion_task_id and archived_at fields to users table
-- Created: 2025-01-24
-- Description: Adds fields to support task ID storage for cancellation and archive mechanism

-- Add deletion_task_id column for storing Celery task ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_task_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_deletion_task_id ON users(deletion_task_id);

-- Add archived_at column for tracking when account was archived
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Update account_status constraint to include 'archived'
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_account_status;
ALTER TABLE users ADD CONSTRAINT valid_account_status 
    CHECK (account_status IN ('active', 'suspended', 'deleted', 'archived'));

