-- users 테이블에 이메일과 전화번호 추가
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;

-- 기존 admin 사용자의 세션 삭제
DELETE FROM sessions WHERE user_id = 1;

-- 기존 admin 계정 업데이트
UPDATE users 
SET username = 'sangchun11', 
    password = 'a2636991!@#', 
    email = 'admin@example.com',
    phone = '010-0000-0000'
WHERE id = 1;

-- 비밀번호 재설정 토큰 테이블
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
