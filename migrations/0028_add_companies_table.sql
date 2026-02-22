-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 0028: 업체(사업자) 관리 테이블 추가
-- 작성일: 2026-02-22
-- 목적: 사업자 계약을 위한 업체 정보 관리 및 신분증 1회 등록 기능
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. companies 테이블 생성 (업체 정보)
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  business_number TEXT UNIQUE NOT NULL,
  representative TEXT NOT NULL,
  representative_resident_number TEXT NOT NULL,
  representative_phone TEXT NOT NULL,
  business_postcode TEXT,
  business_address TEXT NOT NULL,
  business_detail_address TEXT,
  representative_postcode TEXT,
  representative_address TEXT NOT NULL,
  representative_detail_address TEXT,
  id_card_photo TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
