-- 업체 계약서 테이블의 driving_age 컬럼을 license_type으로 변경
-- SQLite는 RENAME COLUMN을 지원하므로 직접 변경
ALTER TABLE business_contracts RENAME COLUMN driving_age TO license_type;
