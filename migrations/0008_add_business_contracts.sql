-- 업체 계약서 테이블 생성
CREATE TABLE IF NOT EXISTS business_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  contract_number TEXT UNIQUE NOT NULL,
  
  -- 업체 정보
  company_name TEXT NOT NULL,
  business_number TEXT NOT NULL,
  representative TEXT NOT NULL,
  business_type TEXT NOT NULL,
  business_category TEXT NOT NULL,
  business_phone TEXT NOT NULL,
  business_address TEXT NOT NULL,
  
  -- 대표자 정보
  representative_resident_number TEXT NOT NULL,
  representative_phone TEXT NOT NULL,
  representative_address TEXT NOT NULL,
  
  -- 계약 정보
  contract_start_date TEXT NOT NULL,
  contract_end_date TEXT NOT NULL,
  insurance_start_date TEXT NOT NULL,
  insurance_end_date TEXT NOT NULL,
  license_type TEXT NOT NULL,
  daily_amount INTEGER NOT NULL,
  deposit INTEGER DEFAULT 0,
  special_terms TEXT,
  
  -- 서류
  business_license_photo TEXT,
  id_card_photo TEXT,
  
  -- 상태
  status TEXT DEFAULT 'active',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_business_contracts_motorcycle_id ON business_contracts(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_business_contracts_contract_number ON business_contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_business_contracts_company_name ON business_contracts(company_name);
CREATE INDEX IF NOT EXISTS idx_business_contracts_status ON business_contracts(status);
