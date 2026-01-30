-- 업체 계약서 테이블의 license_type 컬럼을 driving_range로 변경
ALTER TABLE business_contracts RENAME COLUMN license_type TO driving_range;
