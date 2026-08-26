-- 업무위탁계약서 테이블 생성
CREATE TABLE IF NOT EXISTS work_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_number TEXT UNIQUE NOT NULL,
  
  -- 근로자(위탁자) 정보
  worker_name TEXT NOT NULL,
  worker_phone TEXT NOT NULL,
  worker_id_number TEXT NOT NULL,  -- 주민등록번호
  worker_address TEXT NOT NULL,
  
  -- 계약 정보
  contract_type TEXT DEFAULT 'delivery',  -- delivery: 배달대행
  start_date TEXT NOT NULL,
  end_date TEXT,  -- NULL이면 무기한
  work_area TEXT,  -- 근무 지역
  payment_type TEXT DEFAULT 'commission',  -- commission: 건당수수료, daily: 일당, monthly: 월급
  payment_amount TEXT,  -- 금액 정보 (텍스트로 저장)
  
  -- 근무 조건
  work_hours TEXT,  -- 근무시간
  work_days TEXT,  -- 근무요일
  special_terms TEXT,  -- 특약사항
  
  -- 서명 정보
  status TEXT DEFAULT 'pending',  -- pending, active, completed, cancelled
  signature_data TEXT,  -- 서명 이미지 (base64)
  signature_date TEXT,
  signed_at TEXT,
  
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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_contracts_worker_name ON work_contracts(worker_name);
CREATE INDEX IF NOT EXISTS idx_work_contracts_worker_phone ON work_contracts(worker_phone);
CREATE INDEX IF NOT EXISTS idx_work_contracts_status ON work_contracts(status);
CREATE INDEX IF NOT EXISTS idx_work_contracts_share_token ON work_contracts(share_token);
CREATE INDEX IF NOT EXISTS idx_work_contracts_created_at ON work_contracts(created_at);
