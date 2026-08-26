-- Add company signature, worker signature and ID card image columns to work_contracts
ALTER TABLE work_contracts ADD COLUMN company_signature TEXT;
ALTER TABLE work_contracts ADD COLUMN worker_signature TEXT;
ALTER TABLE work_contracts ADD COLUMN id_card_image TEXT;

-- Remove old signature_data column if exists
-- Note: SQLite doesn't support DROP COLUMN in older versions, so we keep both for compatibility
