-- Add status column to users table for account activation/deactivation
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- Create index for faster status queries
CREATE INDEX idx_users_status ON users(status);
