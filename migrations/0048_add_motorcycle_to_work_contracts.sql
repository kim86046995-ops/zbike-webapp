-- Add motorcycle_id to work_contracts table for tracking which motorcycle is used

ALTER TABLE work_contracts ADD COLUMN motorcycle_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_work_contracts_motorcycle ON work_contracts(motorcycle_id);
