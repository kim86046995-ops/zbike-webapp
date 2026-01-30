-- 차용증 테이블 수정 (배달대행업 특화)
-- 기존 loan_contracts 테이블 삭제 후 재생성

DROP TABLE IF EXISTS loan_contracts;

CREATE TABLE loan_contracts (
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
    loan_amount INTEGER NOT NULL,              -- 차용 금액
    loan_date DATE NOT NULL,                   -- 차용일
    loan_period INTEGER NOT NULL,              -- 대여 기간 (일수)
    repayment_date DATE NOT NULL,              -- 상환 예정일
    interest_rate REAL NOT NULL DEFAULT 0,     -- 이자율 (연%)
    daily_deduction INTEGER NOT NULL,          -- 일차감 금액
    
    -- 현재 상태
    remaining_amount INTEGER NOT NULL,         -- 남은 차용금
    total_deducted INTEGER NOT NULL DEFAULT 0, -- 총 차감 금액
    last_deduction_date DATE,                  -- 마지막 차감일
    
    -- 기타
    collateral TEXT,                           -- 담보
    special_terms TEXT,                        -- 특약사항
    
    -- 서명 및 신분증
    borrower_signature TEXT,                   -- 차용인 서명 (base64)
    lender_signature TEXT,                     -- 대여인 서명 (base64)
    borrower_id_card_photo TEXT,              -- 차용인 신분증 (base64)
    
    -- 상태
    status TEXT NOT NULL DEFAULT 'active',     -- active, completed, overdue, cancelled
    
    -- 타임스탬프
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_loan_contracts_borrower ON loan_contracts(borrower_name);
CREATE INDEX idx_loan_contracts_status ON loan_contracts(status);
CREATE INDEX idx_loan_contracts_loan_date ON loan_contracts(loan_date);

-- 일차감 기록 테이블 생성
CREATE TABLE IF NOT EXISTS loan_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    deduction_date DATE NOT NULL,              -- 차감일
    work_amount INTEGER NOT NULL,              -- 일한 금액
    deduction_amount INTEGER NOT NULL,         -- 차감 금액
    remaining_amount INTEGER NOT NULL,         -- 차감 후 남은 금액
    notes TEXT,                                -- 메모
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loan_contracts(id)
);

CREATE INDEX idx_loan_deductions_loan_id ON loan_deductions(loan_id);
CREATE INDEX idx_loan_deductions_date ON loan_deductions(deduction_date);
