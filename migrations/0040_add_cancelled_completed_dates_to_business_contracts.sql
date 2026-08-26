-- Add cancelled_at and completed_at columns to business_contracts table
ALTER TABLE business_contracts ADD COLUMN cancelled_at TEXT;
ALTER TABLE business_contracts ADD COLUMN completed_at TEXT;

-- Update existing cancelled business contracts to set cancelled_at
UPDATE business_contracts 
SET cancelled_at = contract_end_date 
WHERE status = 'cancelled' AND cancelled_at IS NULL AND contract_end_date IS NOT NULL;

-- Update existing completed business contracts to set completed_at
UPDATE business_contracts 
SET completed_at = contract_end_date 
WHERE status = 'completed' AND completed_at IS NULL AND contract_end_date IS NOT NULL;
