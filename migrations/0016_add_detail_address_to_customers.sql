-- Migration: Add detail_address column to customers table
-- Description: Add detail_address column to store detailed address (e.g., 101-601, 10동601호)
-- Created: 2026-02-02

-- Add detail_address column to customers table
ALTER TABLE customers ADD COLUMN detail_address TEXT;

-- Update existing records to extract detail_address from address if possible
-- This is a one-time migration to split existing addresses
UPDATE customers 
SET detail_address = SUBSTR(address, INSTR(address, '] ') + 2)
WHERE address LIKE '[%]%' AND detail_address IS NULL;
