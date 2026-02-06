-- Migration: 업체 테이블에서 업태/종목 컬럼 제거
-- Created: 2026-02-02

-- SQLite는 ALTER TABLE DROP COLUMN을 지원하지 않으므로
-- 테이블을 재생성해야 합니다

-- 1. 새로운 테이블 생성 (업태/종목 제외)
CREATE TABLE IF NOT EXISTS companies_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business_number TEXT NOT NULL,
  representative TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  detail_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 기존 데이터 복사
INSERT INTO companies_new (id, name, business_number, representative, phone, address, detail_address, created_at, updated_at)
SELECT id, name, business_number, representative, phone, address, detail_address, created_at, updated_at
FROM companies;

-- 3. 기존 테이블 삭제
DROP TABLE companies;

-- 4. 새 테이블 이름 변경
ALTER TABLE companies_new RENAME TO companies;
