-- 로컬 companies 테이블을 프로덕션 구조와 일치시키기
-- 기존 테이블 삭제 후 재생성

DROP TABLE IF EXISTS companies;

CREATE TABLE companies (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  company_code TEXT
);

-- 샘플 데이터 추가
INSERT INTO companies (
  company_name, 
  business_number, 
  company_code, 
  representative, 
  representative_resident_number, 
  representative_phone, 
  representative_postcode, 
  representative_address, 
  representative_detail_address,
  status
) VALUES 
  ('Z-BIKE 광주점', '123-45-67890', 'ZB-GJ-001', '김철수', '700101-1234567', '062-123-4567', '61940', '광주광역시 서구 치평동', '1층', 'active'),
  ('배달의민족 광주지사', '234-56-78901', 'BM-GJ-001', '이영희', '750505-2345678', '062-234-5678', '61947', '광주광역시 서구 상무대로', '5층', 'active'),
  ('쿠팡이츠 광주센터', '345-67-89012', 'CP-GJ-001', '박민수', '800909-1456789', '062-345-6789', '61949', '광주광역시 서구 운천로', '2층', 'active');

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_companies_business_number ON companies(business_number);
CREATE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
