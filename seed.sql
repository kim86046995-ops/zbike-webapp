-- 테스트 오토바이 데이터
INSERT INTO motorcycles (
  plate_number, vehicle_name, chassis_number, mileage, model_year,
  insurance_company, insurance_start_date, insurance_end_date,
  driving_range, owner_name, insurance_fee, vehicle_price, status
) VALUES 
(
  '12가3456', '혼다 PCX 160', 'MLHJE1234567890', 5000, 2023,
  '삼성화재', '2024-01-01', '2024-12-31',
  '전국', '김철수', 800000, 4500000, 'available'
),
(
  '서울45나6789', '야마하 XMAX 300', 'JYACJ1234567890', 12000, 2022,
  'KB손해보험', '2024-01-15', '2025-01-14',
  '수도권', '이영희', 950000, 7200000, 'available'
),
(
  '34다5678', '스즈키 버그만 400', 'JS1CG1234567890', 8500, 2023,
  '현대해상', '2024-02-01', '2025-01-31',
  '전국', '박민수', 1100000, 8500000, 'available'
);

-- 테스트 고객 데이터
INSERT INTO customers (name, resident_number, phone, address, license_type)
VALUES 
('홍길동', '850101-1234567', '010-1234-5678', '서울시 강남구 테헤란로 123', '1종 보통'),
('김영희', '920315-2345678', '010-2345-6789', '경기도 성남시 분당구 판교로 456', '2종 소형');
