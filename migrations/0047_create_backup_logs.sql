-- 자동 백업 로그 테이블 생성
CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id INTEGER,
  backup_time DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_backup_logs_backup_time ON backup_logs(backup_time);
CREATE INDEX IF NOT EXISTS idx_backup_logs_table_name ON backup_logs(table_name);
