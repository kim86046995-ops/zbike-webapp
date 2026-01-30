-- sangchun11 계정을 슈퍼관리자로 업데이트
UPDATE users SET role = 'super_admin' WHERE username = 'sangchun11';

-- 관리자 회원가입 페이지용 테이블
CREATE TABLE IF NOT EXISTS admin_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL,
  used BOOLEAN DEFAULT 0,
  used_by INTEGER,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (used_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_code ON admin_invites(invite_code);
