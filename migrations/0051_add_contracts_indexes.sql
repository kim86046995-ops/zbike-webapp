-- 계약서 목록 조회 성능 최적화를 위한 인덱스 추가
-- 목표: 3.7초 → 1~2초로 단축

-- 1. contracts 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON contracts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_motorcycle_id ON contracts(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

-- 2. motorcycles 테이블 인덱스 (JOIN 최적화)
CREATE INDEX IF NOT EXISTS idx_motorcycles_id ON motorcycles(id);
CREATE INDEX IF NOT EXISTS idx_motorcycles_plate_number ON motorcycles(plate_number);

-- 3. customers 테이블 인덱스 (JOIN 최적화)
CREATE INDEX IF NOT EXISTS idx_customers_id ON customers(id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 4. 복합 인덱스 (WHERE 조건 최적화)
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_status ON contracts(deleted_at, status);
