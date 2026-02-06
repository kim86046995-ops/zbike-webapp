-- Add contract information columns to motorcycles table
ALTER TABLE motorcycles ADD COLUMN monthly_fee INTEGER DEFAULT 0;
ALTER TABLE motorcycles ADD COLUMN contract_type_text TEXT DEFAULT '';
ALTER TABLE motorcycles ADD COLUMN deposit INTEGER DEFAULT 0;
ALTER TABLE motorcycles ADD COLUMN contract_start_date TEXT DEFAULT '';
ALTER TABLE motorcycles ADD COLUMN contract_end_date TEXT DEFAULT '';
