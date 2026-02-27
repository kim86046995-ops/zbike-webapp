-- 오토바이 소프트 삭제를 위한 deleted_at 컬럼 추가
-- 이력 보존 원칙: motorcycle_history는 절대 삭제하지 않음
-- 오토바이 본체만 deleted_at으로 표시하여 1년 보관 후 자동 삭제 가능

ALTER TABLE motorcycles ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- 삭제된 오토바이를 제외한 쿼리를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_motorcycles_deleted_at ON motorcycles(deleted_at);

-- 참고: motorcycle_history 테이블은 이미 존재하며, 이력은 절대 삭제하지 않음
-- 폐지된 오토바이도 이력은 영구 보존
