-- 업체 테이블에 서명과 신분증 컬럼 추가
ALTER TABLE companies ADD COLUMN signature_data TEXT;
ALTER TABLE companies ADD COLUMN id_card_photo TEXT;
