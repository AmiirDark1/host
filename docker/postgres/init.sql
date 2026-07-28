-- PostgreSQL Initialization Script for Hosting Control Panel
-- This runs on first database creation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schema for organization
CREATE SCHEMA IF NOT EXISTS hosting AUTHORIZATION hosting_admin;

-- Set search path
SET search_path TO hosting, public;

-- Create audit log table for tracking all changes
CREATE TABLE IF NOT EXISTS hosting.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON hosting.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON hosting.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON hosting.audit_log(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION hosting.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function for audit logging
CREATE OR REPLACE FUNCTION hosting.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO hosting.audit_log (user_id, action, entity_type, entity_id, new_values)
        VALUES (
            current_setting('app.current_user_id', TRUE)::UUID,
            'CREATE',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(NEW)::JSONB
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO hosting.audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (
            current_setting('app.current_user_id', TRUE)::UUID,
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(OLD)::JSONB,
            row_to_json(NEW)::JSONB
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO hosting.audit_log (user_id, action, entity_type, entity_id, old_values)
        VALUES (
            current_setting('app.current_user_id', TRUE)::UUID,
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            row_to_json(OLD)::JSONB
        );
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create default admin user (password will be set by application)
INSERT INTO hosting.users (
    id,
    email,
    username,
    password_hash,
    role,
    is_active,
    is_verified,
    is_superuser
) VALUES (
    uuid_generate_v4(),
    'admin@hostingpanel.com',
    'admin',
    '', -- Password set by application on first run
    'admin',
    TRUE,
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Create default hosting plans
INSERT INTO hosting.hosting_plans (id, name, description, disk_space_mb, cpu_limit, ram_limit_mb, swap_mb, bandwidth_mb, php_version, redis_enabled, woocommerce_enabled, ssl_enabled, backup_retention_days, sftp_users, price_monthly, is_active)
VALUES
    (uuid_generate_v4(), 'Starter', 'Perfect for personal blogs and small websites', 10240, 1, 512, 256, 10240, '8.2', FALSE, FALSE, TRUE, 7, 1, 9.99, TRUE),
    (uuid_generate_v4(), 'Business', 'Ideal for small businesses and e-commerce', 20480, 2, 1024, 512, 51200, '8.2', TRUE, TRUE, TRUE, 14, 3, 24.99, TRUE),
    (uuid_generate_v4(), 'Professional', 'For growing businesses with higher traffic', 51200, 4, 2048, 1024, 204800, '8.2', TRUE, TRUE, TRUE, 30, 5, 49.99, TRUE),
    (uuid_generate_v4(), 'Enterprise', 'For high-traffic sites and large enterprises', 204800, 8, 4096, 2048, 1048576, '8.2', TRUE, TRUE, TRUE, 60, 10, 149.99, TRUE)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA hosting TO hosting_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hosting TO hosting_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hosting TO hosting_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA hosting TO hosting_admin;

-- Revoke public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO hosting_admin;