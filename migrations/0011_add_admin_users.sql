-- 관리자 계정 테이블
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- bcrypt 해시
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'admin', -- admin, super_admin
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 관리자 계정 추가 (비밀번호: admin1234)
INSERT INTO admin_users (username, password, name, email, role) 
VALUES ('admin', 'admin1234', '관리자', 'admin@example.com', 'super_admin');

-- 계약서 공유 링크 테이블 (카카오톡 전송용)
CREATE TABLE IF NOT EXISTS contract_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_token TEXT UNIQUE NOT NULL, -- 고유 토큰 (UUID)
  contract_type TEXT NOT NULL, -- 'individual', 'business', 'loan'
  contract_id INTEGER, -- 임시 저장된 계약서 ID (draft 상태)
  contract_data TEXT, -- JSON 형태로 계약서 데이터 저장
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending', -- pending, signed, expired
  expires_at DATETIME, -- 만료 시간 (72시간)
  signed_at DATETIME,
  signature_data TEXT, -- 서명 이미지
  id_card_photo TEXT, -- 신분증 사진
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_contract_shares_token ON contract_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_contract_shares_status ON contract_shares(status);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
