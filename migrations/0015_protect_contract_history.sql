-- 이력 보호 트리거 추가 (수정/삭제 절대 금지)

-- 1. UPDATE 방지 트리거
CREATE TRIGGER IF NOT EXISTS prevent_history_update
BEFORE UPDATE ON contract_history
BEGIN
  SELECT RAISE(ABORT, '❌ 계약 이력은 수정할 수 없습니다. 이력은 영구적으로 보호됩니다.');
END;

-- 2. DELETE 방지 트리거
CREATE TRIGGER IF NOT EXISTS prevent_history_delete
BEFORE DELETE ON contract_history
BEGIN
  SELECT RAISE(ABORT, '❌ 계약 이력은 삭제할 수 없습니다. 이력은 영구적으로 보호됩니다.');
END;

-- 3. 계약 이력 보호 확인용 주석
-- ⚠️ CRITICAL: contract_history 테이블의 데이터는 절대 수정/삭제 불가
-- ⚠️ 모든 변경사항은 새로운 행(row)으로 추가되어야 함
-- ⚠️ 감사 추적(Audit Trail) 및 법적 증거 보존을 위한 필수 조치
