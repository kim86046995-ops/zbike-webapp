-- 사업자 정보 설정 테이블
CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,           -- 사업자 상호
    business_number TEXT NOT NULL,        -- 사업자번호
    representative_name TEXT NOT NULL,    -- 대표자 이름
    phone TEXT,                           -- 전화번호
    address TEXT,                         -- 주소
    bank_name TEXT,                       -- 은행명
    account_number TEXT,                  -- 계좌번호
    account_holder TEXT,                  -- 예금주
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 사업자 정보 삽입
INSERT INTO company_settings (company_name, business_number, representative_name)
VALUES ('배달대행 회사', '000-00-00000', '대표자명');

-- loan_contracts 테이블 수정: collateral -> account_number
-- SQLite는 컬럼 이름 변경을 직접 지원하지 않으므로 테이블 재생성
CREATE TABLE loan_contracts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_number TEXT UNIQUE NOT NULL,
    
    -- 차용인 정보
    borrower_name TEXT NOT NULL,
    borrower_resident_number TEXT NOT NULL,
    borrower_phone TEXT NOT NULL,
    borrower_address TEXT NOT NULL,
    
    -- 대여인 정보 (회사)
    lender_name TEXT NOT NULL DEFAULT '배달대행 회사',
    lender_resident_number TEXT,
    lender_phone TEXT,
    lender_address TEXT,
    
    -- 차용 상세 (배달대행업 특화)
    loan_amount INTEGER NOT NULL,
    loan_date DATE NOT NULL,
    loan_period INTEGER NOT NULL,
    repayment_date DATE NOT NULL,
    interest_rate REAL NOT NULL DEFAULT 0,
    daily_deduction INTEGER NOT NULL,
    
    -- 현재 상태
    remaining_amount INTEGER NOT NULL,
    total_deducted INTEGER NOT NULL DEFAULT 0,
    last_deduction_date DATE,
    
    -- 계좌번호 (기존 담보 필드 대체)
    account_number TEXT,
    special_terms TEXT,
    
    -- 서명 및 신분증
    borrower_signature TEXT,
    lender_signature TEXT,
    borrower_id_card_photo TEXT,
    
    -- 상태
    status TEXT NOT NULL DEFAULT 'active',
    
    -- 타임스탬프
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기존 데이터 복사 (collateral -> account_number)
INSERT INTO loan_contracts_new SELECT * FROM loan_contracts;

-- 기존 테이블 삭제 및 새 테이블로 교체
DROP TABLE loan_contracts;
ALTER TABLE loan_contracts_new RENAME TO loan_contracts;

-- 인덱스 재생성
CREATE INDEX idx_loan_contracts_borrower ON loan_contracts(borrower_name);
CREATE INDEX idx_loan_contracts_status ON loan_contracts(status);
CREATE INDEX idx_loan_contracts_loan_date ON loan_contracts(loan_date);
