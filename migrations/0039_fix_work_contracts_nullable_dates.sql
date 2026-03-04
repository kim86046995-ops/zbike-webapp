-- work_contracts 테이블의 start_date를 NULL 허용으로 변경
-- SQLite는 ALTER COLUMN을 지원하지 않으므로 테이블 재생성 필요

-- 1. 임시 테이블 생성 (start_date NULL 허용)
CREATE TABLE IF NOT EXISTS work_contracts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_number TEXT UNIQUE NOT NULL,
  
  -- 근로자(위탁자) 정보
  worker_name TEXT NOT NULL,
  worker_phone TEXT NOT NULL,
  worker_id_number TEXT,  -- NULL 허용으로 변경
  worker_address TEXT,     -- NULL 허용으로 변경
  
  -- 계약 정보
  contract_type TEXT DEFAULT 'delivery',
  start_date TEXT,         -- NULL 허용으로 변경
  end_date TEXT,
  work_area TEXT,
  payment_type TEXT DEFAULT 'commission',
  payment_amount TEXT,
  
  -- 근무 조건
  work_hours TEXT,
  work_days TEXT,
  special_terms TEXT,
  
  -- 서명 정보
  status TEXT DEFAULT 'pending',
  signature_data TEXT,
  signature_date TEXT,
  signed_at TEXT,
  company_signature TEXT,
  worker_signature TEXT,
  id_card_image TEXT,
  
  -- 공유 링크
  share_token TEXT UNIQUE,
  share_expires_at TEXT,
  
  -- 메타데이터
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  deleted_at TEXT,
  cancelled_at TEXT
);

-- 2. 기존 데이터 복사 (있다면)
INSERT INTO work_contracts_new 
SELECT * FROM work_contracts;

-- 3. 기존 테이블 삭제
DROP TABLE work_contracts;

-- 4. 새 테이블 이름 변경
ALTER TABLE work_contracts_new RENAME TO work_contracts;

-- 5. 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_work_contracts_worker_name ON work_contracts(worker_name);
CREATE INDEX IF NOT EXISTS idx_work_contracts_worker_phone ON work_contracts(worker_phone);
CREATE INDEX IF NOT EXISTS idx_work_contracts_status ON work_contracts(status);
CREATE INDEX IF NOT EXISTS idx_work_contracts_share_token ON work_contracts(share_token);
CREATE INDEX IF NOT EXISTS idx_work_contracts_created_at ON work_contracts(created_at);
