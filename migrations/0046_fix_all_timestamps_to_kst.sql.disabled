-- Fix all existing timestamps to Korean Standard Time (KST, UTC+9)
-- This migration adds 9 hours to all datetime fields that were stored in UTC

-- Users table
UPDATE users 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Motorcycles table
UPDATE motorcycles 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

UPDATE motorcycles 
SET deleted_at = datetime(deleted_at, '+9 hours')
WHERE deleted_at IS NOT NULL;

-- Customers table
UPDATE customers 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Contracts table
UPDATE contracts 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

UPDATE contracts 
SET start_date = datetime(start_date, '+9 hours')
WHERE start_date IS NOT NULL;

UPDATE contracts 
SET end_date = datetime(end_date, '+9 hours')
WHERE end_date IS NOT NULL;

UPDATE contracts 
SET cancelled_at = datetime(cancelled_at, '+9 hours')
WHERE cancelled_at IS NOT NULL;

UPDATE contracts 
SET completed_at = datetime(completed_at, '+9 hours')
WHERE completed_at IS NOT NULL;

UPDATE contracts 
SET deleted_at = datetime(deleted_at, '+9 hours')
WHERE deleted_at IS NOT NULL;

UPDATE contracts 
SET motorcycle_photo_upload_date = datetime(motorcycle_photo_upload_date, '+9 hours')
WHERE motorcycle_photo_upload_date IS NOT NULL;

-- Business contracts table
UPDATE business_contracts 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

UPDATE business_contracts 
SET contract_start_date = datetime(contract_start_date, '+9 hours')
WHERE contract_start_date IS NOT NULL;

UPDATE business_contracts 
SET contract_end_date = datetime(contract_end_date, '+9 hours')
WHERE contract_end_date IS NOT NULL;

UPDATE business_contracts 
SET cancelled_at = datetime(cancelled_at, '+9 hours')
WHERE cancelled_at IS NOT NULL;

UPDATE business_contracts 
SET completed_at = datetime(completed_at, '+9 hours')
WHERE completed_at IS NOT NULL;

UPDATE business_contracts 
SET deleted_at = datetime(deleted_at, '+9 hours')
WHERE deleted_at IS NOT NULL;

UPDATE business_contracts 
SET motorcycle_photo_upload_date = datetime(motorcycle_photo_upload_date, '+9 hours')
WHERE motorcycle_photo_upload_date IS NOT NULL;

-- Work contracts (temporary rent) table
UPDATE work_contracts 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Loan contracts table
UPDATE loan_contracts 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Insurances table
UPDATE insurances 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

UPDATE insurances 
SET start_date = datetime(start_date, '+9 hours')
WHERE start_date IS NOT NULL;

UPDATE insurances 
SET end_date = datetime(end_date, '+9 hours')
WHERE end_date IS NOT NULL;

-- Companies table
UPDATE companies 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Businesses table
UPDATE businesses 
SET created_at = datetime(created_at, '+9 hours'),
    updated_at = datetime(updated_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Contract history table
UPDATE contract_history 
SET changed_at = datetime(changed_at, '+9 hours')
WHERE changed_at IS NOT NULL;

-- Motorcycle history table
UPDATE motorcycle_history 
SET changed_at = datetime(changed_at, '+9 hours')
WHERE changed_at IS NOT NULL;

-- Sessions table
UPDATE sessions 
SET created_at = datetime(created_at, '+9 hours'),
    expires_at = datetime(expires_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Password reset tokens table
UPDATE password_reset_tokens 
SET created_at = datetime(created_at, '+9 hours'),
    expires_at = datetime(expires_at, '+9 hours')
WHERE created_at IS NOT NULL;

-- Business contract tokens table
UPDATE business_contract_tokens 
SET created_at = datetime(created_at, '+9 hours'),
    expires_at = datetime(expires_at, '+9 hours')
WHERE created_at IS NOT NULL;
