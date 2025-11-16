-- Migration: Create audit_logs table
-- Created: 2025-01-24
-- Description: Creates audit log table for compliance and security tracking

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Composite index for common queries (user actions over time)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_time ON audit_logs(user_id, action, created_at);

