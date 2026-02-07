-- 오토바이 변경 이력 테이블 생성
CREATE TABLE IF NOT EXISTS motorcycle_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  change_type TEXT NOT NULL, -- 'update', 'status_change', 'insurance_update', 'inspection_update'
  field_name TEXT NOT NULL, -- 변경된 필드명
  old_value TEXT, -- 이전 값
  new_value TEXT, -- 새로운 값
  changed_by INTEGER, -- 변경한 관리자 ID
  change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT, -- 변경 사유 또는 메모
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_motorcycle_history_motorcycle_id ON motorcycle_history(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_motorcycle_history_change_date ON motorcycle_history(change_date);
CREATE INDEX IF NOT EXISTS idx_motorcycle_history_change_type ON motorcycle_history(change_type);
