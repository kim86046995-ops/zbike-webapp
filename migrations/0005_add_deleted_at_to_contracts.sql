-- Add soft delete column to contracts table
ALTER TABLE contracts ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX idx_contracts_deleted_at ON contracts(deleted_at);
