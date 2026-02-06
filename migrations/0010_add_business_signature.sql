-- Add signature_data column to business_contracts table
ALTER TABLE business_contracts ADD COLUMN signature_data TEXT;

-- Add driving_range column if not exists (for compatibility)
ALTER TABLE business_contracts ADD COLUMN driving_range TEXT;
