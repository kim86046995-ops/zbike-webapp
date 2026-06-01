-- Fix invalid date formats in contracts  
UPDATE contracts SET end_date = '2026-02-27' WHERE end_date = '20260227';

-- Fix contracts dates (2025년 이전 데이터만)
UPDATE contracts SET start_date = date(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2025-01-01';
UPDATE contracts SET end_date = date(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2025-01-01';
UPDATE contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2025-01-01';
UPDATE contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2025-01-01';

-- Fix business_contracts dates (2025년 이전 데이터만)
UPDATE business_contracts SET start_date = date(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2025-01-01';
UPDATE business_contracts SET end_date = date(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2025-01-01';
UPDATE business_contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2025-01-01';
UPDATE business_contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2025-01-01';

-- Fix work_contracts dates (2025년 이전 데이터만)
UPDATE work_contracts SET start_date = date(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2025-01-01';
UPDATE work_contracts SET end_date = date(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2025-01-01';
UPDATE work_contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2025-01-01';
UPDATE work_contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2025-01-01';

-- Fix loan_contracts dates (2025년 이전 데이터만)
UPDATE loan_contracts SET contract_start_date = date(contract_start_date, '+9 hours') WHERE contract_start_date IS NOT NULL AND contract_start_date < '2025-01-01';
UPDATE loan_contracts SET contract_end_date = date(contract_end_date, '+9 hours') WHERE contract_end_date IS NOT NULL AND contract_end_date < '2025-01-01';
UPDATE loan_contracts SET terminated_at = datetime(terminated_at, '+9 hours') WHERE terminated_at IS NOT NULL AND terminated_at < '2025-01-01';

-- Fix insurances dates (2025년 이전 데이터만)
UPDATE insurances SET insurance_start_date = date(insurance_start_date, '+9 hours') WHERE insurance_start_date IS NOT NULL AND insurance_start_date < '2025-01-01';
UPDATE insurances SET insurance_end_date = date(insurance_end_date, '+9 hours') WHERE insurance_end_date IS NOT NULL AND insurance_end_date < '2025-01-01';

-- Fix history timestamps (2025년 이전 데이터만)
UPDATE contract_history SET changed_at = datetime(changed_at, '+9 hours') WHERE changed_at IS NOT NULL AND changed_at < '2025-01-01';
UPDATE motorcycle_history SET changed_at = datetime(changed_at, '+9 hours') WHERE changed_at IS NOT NULL AND changed_at < '2025-01-01';
