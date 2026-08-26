-- Fix invalid date formats in contracts
UPDATE contracts SET end_date = '2026-02-27' WHERE end_date = '20260227';

-- Now fix timestamps for dates before 2026
UPDATE contracts SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2026-01-01' AND length(end_date) = 10;
UPDATE contracts SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date != '' AND start_date < '2026-01-01' AND length(start_date) = 10;

UPDATE business_contracts SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2026-01-01' AND length(end_date) = 10;
UPDATE business_contracts SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date != '' AND start_date < '2026-01-01' AND length(start_date) = 10;

UPDATE work_contracts SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2026-01-01';
UPDATE work_contracts SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date != '' AND start_date < '2026-01-01';

UPDATE loan_contracts SET contract_end_date = datetime(contract_end_date, '+9 hours') WHERE contract_end_date IS NOT NULL AND contract_end_date != '' AND contract_end_date < '2026-01-01';
UPDATE loan_contracts SET contract_start_date = datetime(contract_start_date, '+9 hours') WHERE contract_start_date IS NOT NULL AND contract_start_date != '' AND contract_start_date < '2026-01-01';

UPDATE insurances SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date != '' AND end_date < '2026-01-01';
UPDATE insurances SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date != '' AND start_date < '2026-01-01';

-- Fix cancelled/completed timestamps
UPDATE contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2026-01-01';
UPDATE contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2026-01-01';

UPDATE business_contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2026-01-01';
UPDATE business_contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2026-01-01';

UPDATE work_contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2026-01-01';
UPDATE work_contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2026-01-01';

UPDATE loan_contracts SET terminated_at = datetime(terminated_at, '+9 hours') WHERE terminated_at IS NOT NULL AND terminated_at < '2026-01-01';

-- Fix history timestamps
UPDATE contract_history SET changed_at = datetime(changed_at, '+9 hours') WHERE changed_at IS NOT NULL AND changed_at < '2026-01-01';
UPDATE motorcycle_history SET changed_at = datetime(changed_at, '+9 hours') WHERE changed_at IS NOT NULL AND changed_at < '2026-01-01';
