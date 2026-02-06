-- 계약 이력 테이블 생성
CREATE TABLE IF NOT EXISTS contract_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  motorcycle_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  contract_number TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'created', 'updated', 'completed', 'cancelled', 'replaced'
  old_status TEXT,
  new_status TEXT,
  start_date TEXT,
  end_date TEXT,
  monthly_fee INTEGER,
  deposit INTEGER,
  special_terms TEXT,
  action_reason TEXT, -- 해지 사유, 변경 사유 등
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_id ON contract_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_history_motorcycle_id ON contract_history(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_contract_history_customer_id ON contract_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_history_created_at ON contract_history(created_at);
