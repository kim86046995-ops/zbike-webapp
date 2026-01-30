-- Add inspection dates to motorcycles table
ALTER TABLE motorcycles ADD COLUMN inspection_start_date TEXT;
ALTER TABLE motorcycles ADD COLUMN inspection_end_date TEXT;
