-- Migration: 계약자 테이블에 우편번호 컬럼 추가
-- Created: 2026-02-02

ALTER TABLE customers ADD COLUMN postcode TEXT;
