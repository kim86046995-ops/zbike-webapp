-- 오토바이 테이블에 일대여료 필드 추가
ALTER TABLE motorcycles ADD COLUMN daily_rental_fee INTEGER DEFAULT 0;

-- 계약서 테이블에 신분증 사진 필드 추가
ALTER TABLE contracts ADD COLUMN id_card_photo TEXT;

-- 차용증 테이블 생성
CREATE TABLE IF NOT EXISTS loan_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_number TEXT UNIQUE NOT NULL,           -- 차용증 번호
  borrower_name TEXT NOT NULL,                -- 차용인 이름
  borrower_resident_number TEXT NOT NULL,     -- 차용인 주민번호
  borrower_phone TEXT NOT NULL,               -- 차용인 전화번호
  borrower_address TEXT NOT NULL,             -- 차용인 주소
  loan_amount INTEGER NOT NULL,               -- 차용금액
  loan_date TEXT NOT NULL,                    -- 차용일
  repayment_date TEXT NOT NULL,               -- 상환일
  interest_rate REAL DEFAULT 0,               -- 이율 (%)
  repayment_method TEXT,                      -- 상환방법
  collateral TEXT,                            -- 담보
  special_terms TEXT,                         -- 특약사항
  borrower_signature TEXT,                    -- 차용인 서명
  lender_signature TEXT,                      -- 대여인 서명
  borrower_id_card_photo TEXT,                -- 차용인 신분증
  status TEXT DEFAULT 'active',               -- 상태 (active, completed, overdue)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_loan_contracts_number ON loan_contracts(loan_number);
CREATE INDEX IF NOT EXISTS idx_loan_contracts_status ON loan_contracts(status);
CREATE INDEX IF NOT EXISTS idx_loan_contracts_borrower ON loan_contracts(borrower_name);
