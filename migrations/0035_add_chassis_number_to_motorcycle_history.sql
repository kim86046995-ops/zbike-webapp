-- 오토바이 이력 테이블에 차대번호 컬럼 추가
-- 이력은 번호판이 아닌 차대번호(chassis_number)를 기준으로 추적해야 함
-- 번호판은 변경될 수 있지만 차대번호는 절대 변경되지 않는 고유 식별자

-- 1. chassis_number 컬럼 추가
ALTER TABLE motorcycle_history ADD COLUMN chassis_number TEXT;

-- 2. 기존 데이터에 chassis_number 채우기
UPDATE motorcycle_history 
SET chassis_number = (
  SELECT m.chassis_number 
  FROM motorcycles m 
  WHERE m.id = motorcycle_history.motorcycle_id
)
WHERE chassis_number IS NULL;

-- 3. chassis_number 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_motorcycle_history_chassis_number ON motorcycle_history(chassis_number);

-- 참고: motorcycle_id는 여전히 유지하되, chassis_number를 주요 검색 기준으로 사용
