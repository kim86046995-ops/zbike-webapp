-- 업체 테이블의 필드를 NULL 허용으로 변경
-- SQLite는 ALTER COLUMN을 지원하지 않으므로 임시 테이블로 재생성

-- 1. 임시 테이블 생성
CREATE TABLE companies_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  business_number TEXT UNIQUE NOT NULL,
  representative TEXT NOT NULL,
  representative_resident_number TEXT,
  representative_phone TEXT NOT NULL,
  business_postcode TEXT,
  business_address TEXT,
  business_detail_address TEXT,
  representative_postcode TEXT,
  representative_address TEXT,
  representative_detail_address TEXT,
  id_card_photo TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 기존 데이터 복사
INSERT INTO companies_new SELECT * FROM companies;

-- 3. 기존 테이블 삭제
DROP TABLE companies;

-- 4. 새 테이블 이름 변경
ALTER TABLE companies_new RENAME TO companies;

-- 5. 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_companies_business_number ON companies(business_number);
CREATE INDEX IF NOT EXISTS idx_companies_representative_phone ON companies(representative_phone);
CREATE INDEX IF NOT EXISTS idx_companies_representative_resident_number ON companies(representative_resident_number);
CREATE INDEX IF NOT EXISTS idx_companies_representative ON companies(representative);
