-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 0029: companies 테이블 인덱스 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_companies_business_number ON companies(business_number);
CREATE INDEX IF NOT EXISTS idx_companies_rep_phone ON companies(representative_phone);
CREATE INDEX IF NOT EXISTS idx_companies_rep_resident ON companies(representative_resident_number);
CREATE INDEX IF NOT EXISTS idx_companies_rep_name ON companies(representative);
