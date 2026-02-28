-- 계약 테이블에 보험 정보 컬럼 추가
ALTER TABLE contracts ADD COLUMN insurance_company TEXT DEFAULT '';
ALTER TABLE contracts ADD COLUMN insurance_start_date TEXT DEFAULT '';
ALTER TABLE contracts ADD COLUMN insurance_end_date TEXT DEFAULT '';
ALTER TABLE contracts ADD COLUMN driving_range TEXT DEFAULT '';
