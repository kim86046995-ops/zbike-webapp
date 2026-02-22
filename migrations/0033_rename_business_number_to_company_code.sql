-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 0033: business_number를 company_code로 변경
-- 작성일: 2026-02-22
-- 목적: 사업자번호 개념 제거, 업체 코드로 통일
-- 방법: company_code 컬럼 추가 후 business_number 데이터 복사
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. companies 테이블에 company_code 컬럼 추가
ALTER TABLE companies ADD COLUMN company_code TEXT;

-- 2. business_number 데이터를 company_code로 복사
UPDATE companies SET company_code = business_number;

-- 3. business_contracts 테이블에 company_code 컬럼 추가
ALTER TABLE business_contracts ADD COLUMN company_code TEXT;

-- 4. business_number 데이터를 company_code로 복사
UPDATE business_contracts SET company_code = business_number;

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
CREATE INDEX IF NOT EXISTS idx_business_contracts_company_code ON business_contracts(company_code);
