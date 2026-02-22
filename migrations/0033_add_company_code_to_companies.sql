-- Add company_code column to companies table for JOIN with business_contracts
ALTER TABLE companies ADD COLUMN company_code TEXT;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_companies_company_code ON companies(company_code);

-- Update existing records: set company_code to business_number
UPDATE companies SET company_code = business_number WHERE company_code IS NULL;
