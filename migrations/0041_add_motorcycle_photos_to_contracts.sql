-- 계약서에 오토바이 출고 사진 4개 필드 추가
-- 출고 시 오토바이의 현재 상태를 기록하여 반납 시 파손 여부 확인

-- 개인 계약서 테이블에 오토바이 사진 추가
ALTER TABLE contracts ADD COLUMN motorcycle_photo_front TEXT;
ALTER TABLE contracts ADD COLUMN motorcycle_photo_back TEXT;
ALTER TABLE contracts ADD COLUMN motorcycle_photo_left TEXT;
ALTER TABLE contracts ADD COLUMN motorcycle_photo_right TEXT;
ALTER TABLE contracts ADD COLUMN motorcycle_photo_upload_date DATETIME;

-- 업체 계약서 테이블에 오토바이 사진 추가
ALTER TABLE business_contracts ADD COLUMN motorcycle_photo_front TEXT;
ALTER TABLE business_contracts ADD COLUMN motorcycle_photo_back TEXT;
ALTER TABLE business_contracts ADD COLUMN motorcycle_photo_left TEXT;
ALTER TABLE business_contracts ADD COLUMN motorcycle_photo_right TEXT;
ALTER TABLE business_contracts ADD COLUMN motorcycle_photo_upload_date DATETIME;
