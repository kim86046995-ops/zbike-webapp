-- Add terms_agreed column to companies table
ALTER TABLE companies ADD COLUMN terms_agreed INTEGER DEFAULT 0;
-- 0 = 동의 안함, 1 = 동의함

-- Add terms_agreed_at column to track when terms were agreed
ALTER TABLE companies ADD COLUMN terms_agreed_at DATETIME;
