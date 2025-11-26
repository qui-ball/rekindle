-- Migration: Create users table
-- Date: 2025-11-11
-- Description: Introduces users table with Supabase linkage and subscription metadata

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_image_url TEXT,

    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
    monthly_credits INTEGER NOT NULL DEFAULT 3,
    topup_credits INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
    subscription_period_start TIMESTAMPTZ,
    subscription_period_end TIMESTAMPTZ,

    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    storage_limit_bytes BIGINT NOT NULL DEFAULT 0,

    account_status VARCHAR(20) NOT NULL DEFAULT 'active',
    deletion_requested_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    CONSTRAINT users_supabase_unique UNIQUE (supabase_user_id),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT chk_users_subscription_tier CHECK (subscription_tier IN ('free', 'remember', 'cherish', 'forever')),
    CONSTRAINT chk_users_subscription_status CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'paused')),
    CONSTRAINT chk_users_account_status CHECK (account_status IN ('active', 'suspended', 'deleted'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Table and column comments
COMMENT ON TABLE users IS 'Supabase-authenticated user profiles and subscription metadata.';
COMMENT ON COLUMN users.supabase_user_id IS 'Supabase auth user identifier (sub).';
COMMENT ON COLUMN users.storage_used_bytes IS 'Total bytes stored across user-owned assets.';
COMMENT ON COLUMN users.storage_limit_bytes IS 'Maximum allowed storage for user in bytes.';


