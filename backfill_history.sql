-- 개인 계약 완료 이력 추가 (completed 상태)
INSERT INTO motorcycle_history (
  motorcycle_id, change_type, field_name, old_value, new_value, 
  changed_by, notes, change_date
)
SELECT 
  c.motorcycle_id,
  'contract_completion' as change_type,
  '계약 완료' as field_name,
  '계약번호: ' || c.contract_number as old_value,
  '계약자: ' || COALESCE(cu.name, '알 수 없음') || ', 기간: ' || c.start_date || ' ~ ' || c.end_date || ', 종료일: ' || c.completed_at as new_value,
  NULL as changed_by,
  '계약번호: ' || c.contract_number || ', 계약자: ' || COALESCE(cu.name, '알 수 없음') || ', 계약기간: ' || c.start_date || ' ~ ' || c.end_date || ', 계약종료일: ' || c.completed_at as notes,
  c.completed_at || ' 00:00:00' as change_date
FROM contracts c
LEFT JOIN customers cu ON c.customer_id = cu.id
WHERE c.status = 'completed' 
  AND c.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM motorcycle_history mh 
    WHERE mh.motorcycle_id = c.motorcycle_id 
      AND mh.field_name = '계약 완료'
      AND mh.notes LIKE '%' || c.contract_number || '%'
  );

-- 개인 계약 해지 이력 추가 (cancelled 상태)
INSERT INTO motorcycle_history (
  motorcycle_id, change_type, field_name, old_value, new_value, 
  changed_by, notes, change_date
)
SELECT 
  c.motorcycle_id,
  'contract_cancellation' as change_type,
  '계약 해지' as field_name,
  '계약번호: ' || c.contract_number as old_value,
  '계약자: ' || COALESCE(cu.name, '알 수 없음') || ', 기간: ' || c.start_date || ' ~ ' || c.end_date || ', 종료일: ' || c.cancelled_at as new_value,
  NULL as changed_by,
  '계약번호: ' || c.contract_number || ', 계약자: ' || COALESCE(cu.name, '알 수 없음') || ', 계약기간: ' || c.start_date || ' ~ ' || c.end_date || ', 계약종료일: ' || c.cancelled_at as notes,
  CASE 
    WHEN c.cancelled_at LIKE '____-__-__ __:__:__' THEN c.cancelled_at
    WHEN c.cancelled_at LIKE '____-__-__' THEN c.cancelled_at || ' 00:00:00'
    WHEN c.cancelled_at LIKE '________' THEN 
      substr(c.cancelled_at, 1, 4) || '-' || substr(c.cancelled_at, 5, 2) || '-' || substr(c.cancelled_at, 7, 2) || ' 00:00:00'
    ELSE datetime('now')
  END as change_date
FROM contracts c
LEFT JOIN customers cu ON c.customer_id = cu.id
WHERE c.status = 'cancelled' 
  AND c.cancelled_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM motorcycle_history mh 
    WHERE mh.motorcycle_id = c.motorcycle_id 
      AND mh.field_name = '계약 해지'
      AND mh.notes LIKE '%' || c.contract_number || '%'
  );

-- 업체 계약 완료 이력 추가 (completed 상태)
INSERT INTO motorcycle_history (
  motorcycle_id, change_type, field_name, old_value, new_value, 
  changed_by, notes, change_date
)
SELECT 
  bc.motorcycle_id,
  'business_contract_completion' as change_type,
  '업체계약 완료' as field_name,
  '계약번호: ' || bc.contract_number as old_value,
  '업체: ' || COALESCE(bc.company_name, '알 수 없음') || ', 기간: ' || bc.contract_start_date || ' ~ ' || bc.contract_end_date || ', 종료일: ' || bc.completed_at as new_value,
  NULL as changed_by,
  '계약번호: ' || bc.contract_number || ', 업체: ' || COALESCE(bc.company_name, '알 수 없음') || ', 계약기간: ' || bc.contract_start_date || ' ~ ' || bc.contract_end_date || ', 계약종료일: ' || bc.completed_at as notes,
  bc.completed_at || ' 00:00:00' as change_date
FROM business_contracts bc
WHERE bc.status = 'completed' 
  AND bc.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM motorcycle_history mh 
    WHERE mh.motorcycle_id = bc.motorcycle_id 
      AND mh.field_name = '업체계약 완료'
      AND mh.notes LIKE '%' || bc.contract_number || '%'
  );

-- 업체 계약 해지 이력 추가 (cancelled 상태)
INSERT INTO motorcycle_history (
  motorcycle_id, change_type, field_name, old_value, new_value, 
  changed_by, notes, change_date
)
SELECT 
  bc.motorcycle_id,
  'business_contract_cancellation' as change_type,
  '업체계약 해지' as field_name,
  '계약번호: ' || bc.contract_number as old_value,
  '업체: ' || COALESCE(bc.company_name, '알 수 없음') || ', 기간: ' || bc.contract_start_date || ' ~ ' || bc.contract_end_date || ', 종료일: ' || bc.cancelled_at as new_value,
  NULL as changed_by,
  '계약번호: ' || bc.contract_number || ', 업체: ' || COALESCE(bc.company_name, '알 수 없음') || ', 계약기간: ' || bc.contract_start_date || ' ~ ' || bc.contract_end_date || ', 계약종료일: ' || bc.cancelled_at as notes,
  CASE 
    WHEN bc.cancelled_at LIKE '____-__-__ __:__:__' THEN bc.cancelled_at
    WHEN bc.cancelled_at LIKE '____-__-__' THEN bc.cancelled_at || ' 00:00:00'
    WHEN bc.cancelled_at LIKE '________' THEN 
      substr(bc.cancelled_at, 1, 4) || '-' || substr(bc.cancelled_at, 5, 2) || '-' || substr(bc.cancelled_at, 7, 2) || ' 00:00:00'
    ELSE datetime('now')
  END as change_date
FROM business_contracts bc
WHERE bc.status = 'cancelled' 
  AND bc.cancelled_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM motorcycle_history mh 
    WHERE mh.motorcycle_id = bc.motorcycle_id 
      AND mh.field_name = '업체계약 해지'
      AND mh.notes LIKE '%' || bc.contract_number || '%'
  );
