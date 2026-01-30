-- 오토바이 정보 테이블
CREATE TABLE IF NOT EXISTS motorcycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate_number TEXT UNIQUE NOT NULL,        -- 번호판
  vehicle_name TEXT NOT NULL,               -- 차량이름
  chassis_number TEXT NOT NULL,             -- 차대번호
  mileage INTEGER NOT NULL,                 -- 키로수
  model_year INTEGER NOT NULL,              -- 연식
  insurance_company TEXT NOT NULL,          -- 보험사
  insurance_start_date TEXT NOT NULL,       -- 보험시작일
  insurance_end_date TEXT NOT NULL,         -- 보험종료일
  driving_range TEXT NOT NULL,              -- 운전범위
  owner_name TEXT NOT NULL,                 -- 명의자
  insurance_fee INTEGER NOT NULL,           -- 보험료
  vehicle_price INTEGER NOT NULL,           -- 차량금액
  status TEXT DEFAULT 'available',          -- 상태 (available, rented, maintenance)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 고객 정보 테이블
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                       -- 이름
  resident_number TEXT NOT NULL,            -- 주민번호
  phone TEXT NOT NULL,                      -- 전화번호
  address TEXT NOT NULL,                    -- 주소
  license_type TEXT NOT NULL,               -- 면허종류
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 계약서 테이블
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_type TEXT NOT NULL,              -- 계약타입 (lease, rent)
  motorcycle_id INTEGER NOT NULL,           -- 오토바이 ID
  customer_id INTEGER NOT NULL,             -- 고객 ID
  start_date TEXT NOT NULL,                 -- 계약시작일
  end_date TEXT NOT NULL,                   -- 계약종료일
  monthly_fee INTEGER NOT NULL,             -- 월 납부금액
  deposit INTEGER,                          -- 보증금
  special_terms TEXT,                       -- 특약사항
  signature_data TEXT,                      -- 전자서명 데이터 (base64)
  contract_number TEXT UNIQUE NOT NULL,     -- 계약서 번호
  status TEXT DEFAULT 'active',             -- 상태 (active, completed, cancelled)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_motorcycles_plate ON motorcycles(plate_number);
CREATE INDEX IF NOT EXISTS idx_motorcycles_status ON motorcycles(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_motorcycle ON contracts(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
