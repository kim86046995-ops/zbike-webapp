-- Migration: Create companies table
-- Description: Create companies table for business customer information
-- Created: 2026-02-02

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business_number TEXT NOT NULL,
  representative TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  detail_address TEXT,
  business_category TEXT,
  business_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on business_number for faster lookup
CREATE INDEX IF NOT EXISTS idx_companies_business_number ON companies(business_number);
