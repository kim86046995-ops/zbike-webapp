-- 계약서에 보험운전범위 컬럼 추가
ALTER TABLE contracts ADD COLUMN insurance_age_limit TEXT;

-- 기존 데이터에 기본값 설정 (전연령)
UPDATE contracts SET insurance_age_limit = '전연령' WHERE insurance_age_limit IS NULL;
