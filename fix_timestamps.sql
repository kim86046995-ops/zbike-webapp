-- Fix remaining timestamps
UPDATE contracts SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date < '2026-01-01';
UPDATE contracts SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2026-01-01';
UPDATE contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2026-01-01';
UPDATE contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2026-01-01';
UPDATE contracts SET deleted_at = datetime(deleted_at, '+9 hours') WHERE deleted_at IS NOT NULL AND deleted_at < '2026-01-01';
UPDATE contracts SET motorcycle_photo_upload_date = datetime(motorcycle_photo_upload_date, '+9 hours') WHERE motorcycle_photo_upload_date IS NOT NULL AND motorcycle_photo_upload_date < '2026-01-01';

UPDATE business_contracts SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date < '2026-01-01';
UPDATE business_contracts SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2026-01-01';
UPDATE business_contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2026-01-01';
UPDATE business_contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2026-01-01';
UPDATE business_contracts SET deleted_at = datetime(deleted_at, '+9 hours') WHERE deleted_at IS NOT NULL AND deleted_at < '2026-01-01';
UPDATE business_contracts SET motorcycle_photo_upload_date = datetime(motorcycle_photo_upload_date, '+9 hours') WHERE motorcycle_photo_upload_date IS NOT NULL AND motorcycle_photo_upload_date < '2026-01-01';

UPDATE work_contracts SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date < '2026-01-01';
UPDATE work_contracts SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2026-01-01';
UPDATE work_contracts SET cancelled_at = datetime(cancelled_at, '+9 hours') WHERE cancelled_at IS NOT NULL AND cancelled_at < '2026-01-01';
UPDATE work_contracts SET completed_at = datetime(completed_at, '+9 hours') WHERE completed_at IS NOT NULL AND completed_at < '2026-01-01';

UPDATE loan_contracts SET contract_end_date = datetime(contract_end_date, '+9 hours') WHERE contract_end_date IS NOT NULL AND contract_end_date < '2026-01-01';
UPDATE loan_contracts SET contract_start_date = datetime(contract_start_date, '+9 hours') WHERE contract_start_date IS NOT NULL AND contract_start_date < '2026-01-01';
UPDATE loan_contracts SET last_deduction_date = date(last_deduction_date, '+9 hours') WHERE last_deduction_date IS NOT NULL AND last_deduction_date < '2026-01-01';
UPDATE loan_contracts SET terminated_at = datetime(terminated_at, '+9 hours') WHERE terminated_at IS NOT NULL AND terminated_at < '2026-01-01';

UPDATE insurances SET end_date = datetime(end_date, '+9 hours') WHERE end_date IS NOT NULL AND end_date < '2026-01-01';
UPDATE insurances SET start_date = datetime(start_date, '+9 hours') WHERE start_date IS NOT NULL AND start_date < '2026-01-01';

UPDATE contract_history SET changed_at = datetime(changed_at, '+9 hours') WHERE changed_at IS NOT NULL AND changed_at < '2026-01-01';
UPDATE motorcycle_history SET changed_at = datetime(changed_at, '+9 hours') WHERE changed_at IS NOT NULL AND changed_at < '2026-01-01';
