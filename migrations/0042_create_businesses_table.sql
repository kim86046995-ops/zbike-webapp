-- 업체 정보 등록 테이블 생성
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  business_registration_number TEXT NOT NULL UNIQUE,
  representative_name TEXT NOT NULL,
  manager_phone TEXT NOT NULL,
  postcode TEXT DEFAULT '',
  address TEXT NOT NULL,
  detail_address TEXT DEFAULT '',
  email TEXT,
  business_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_businesses_business_number ON businesses(business_registration_number);
CREATE INDEX IF NOT EXISTS idx_businesses_phone ON businesses(manager_phone);
CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at ON businesses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at DESC);
