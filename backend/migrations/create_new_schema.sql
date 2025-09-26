-- Migration to create new job-based schema
-- Run this after backing up your database

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  selected_restore_id UUID,
  latest_animation_id UUID
);

CREATE INDEX idx_jobs_email ON jobs(email);

-- Create restore_attempts table
CREATE TABLE IF NOT EXISTS restore_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  s3_key TEXT NOT NULL,
  model TEXT,
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_restore_attempts_job_id ON restore_attempts(job_id);

-- Create animation_attempts table
CREATE TABLE IF NOT EXISTS animation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  restore_id UUID REFERENCES restore_attempts(id),
  preview_s3_key TEXT NOT NULL,
  result_s3_key TEXT,
  thumb_s3_key TEXT,
  model TEXT,
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_animation_attempts_job_id ON animation_attempts(job_id);
CREATE INDEX idx_animation_attempts_restore_id ON animation_attempts(restore_id);

-- Add foreign key constraints for the selected/latest columns in jobs table
ALTER TABLE jobs 
  ADD CONSTRAINT fk_jobs_selected_restore 
  FOREIGN KEY (selected_restore_id) 
  REFERENCES restore_attempts(id);

ALTER TABLE jobs 
  ADD CONSTRAINT fk_jobs_latest_animation 
  FOREIGN KEY (latest_animation_id) 
  REFERENCES animation_attempts(id);

-- Optional: Migrate data from old restoration_jobs table if it exists
-- This is commented out by default - uncomment and modify as needed
/*
INSERT INTO jobs (id, email, created_at)
SELECT 
  id,
  user_id as email,  -- assuming user_id was email
  created_at
FROM restoration_jobs;
*/