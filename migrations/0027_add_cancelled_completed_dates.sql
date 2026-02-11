-- Add cancelled_at and completed_at columns to contracts table
ALTER TABLE contracts ADD COLUMN cancelled_at TEXT;
ALTER TABLE contracts ADD COLUMN completed_at TEXT;

-- Update existing cancelled contracts to set cancelled_at
UPDATE contracts 
SET cancelled_at = end_date 
WHERE status = 'cancelled' AND cancelled_at IS NULL AND end_date IS NOT NULL;

-- Update existing completed contracts to set completed_at
UPDATE contracts 
SET completed_at = end_date 
WHERE status = 'completed' AND completed_at IS NULL AND end_date IS NOT NULL;
