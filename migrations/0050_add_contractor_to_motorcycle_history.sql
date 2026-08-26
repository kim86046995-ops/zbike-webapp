-- Add contractor information to motorcycle history
-- 이력에 계약자 정보 추가

ALTER TABLE motorcycle_history ADD COLUMN current_contractor_name TEXT;
