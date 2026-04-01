-- Add deleted_at column to business_contracts table for soft delete
ALTER TABLE business_contracts ADD COLUMN deleted_at DATETIME;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_business_contracts_deleted_at ON business_contracts(deleted_at);
