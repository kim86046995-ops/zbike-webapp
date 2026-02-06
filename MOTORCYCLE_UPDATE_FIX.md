# 오토바이 수정 API 개선

## 🔴 문제 상황
오토바이 정보 수정 시 "수정 실패" 메시지가 나타나며 기본정보, 계약정보, 보험정보 수정이 모두 실패하는 문제

## 🔍 원인 분석

### 기존 API 문제점:
```typescript
// ❌ 기존 코드
app.put('/api/motorcycles/:id', async (c) => {
  const data = await c.req.json()
  
  await DB.prepare(`UPDATE motorcycles SET ... WHERE id = ?`)
    .bind(
      data.plate_number,        // ← undefined일 경우 문제!
      data.vehicle_name,        // ← undefined일 경우 문제!
      data.insurance_company,   // ← undefined일 경우 문제!
      // ... 모든 필드가 필수
    ).run()
})
```

**문제점**:
1. **모든 필드가 필수**: 일부 필드만 업데이트하려고 해도 모든 필드를 보내야 함
2. **undefined 처리 없음**: 보내지 않은 필드는 `undefined`가 되어 DB에 저장 시 오류 발생
3. **부분 업데이트 불가**: 기본정보만, 계약정보만, 보험정보만 따로 업데이트할 수 없음

### 프론트엔드 동작:
```javascript
// 기본정보만 업데이트
await axios.put(`/api/motorcycles/${id}`, {
  plate_number: '...',
  vehicle_name: '...',
  mileage: '...'
  // insurance_company, contract_start_date 등은 보내지 않음
})
```

결과: 보내지 않은 필드들이 `undefined`가 되어 UPDATE 쿼리 실패

## ✅ 해결 방법

### 개선된 API:
```typescript
// ✅ 개선된 코드
app.put('/api/motorcycles/:id', async (c) => {
  const data = await c.req.json()
  
  // 1. 먼저 기존 데이터 조회
  const existing = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?')
    .bind(id).first()
  
  // 2. 기존 데이터와 새 데이터 병합 (새 데이터 우선)
  const mergedData = {
    plate_number: data.plate_number !== undefined 
      ? data.plate_number 
      : existing.plate_number,
    vehicle_name: data.vehicle_name !== undefined 
      ? data.vehicle_name 
      : existing.vehicle_name,
    // ... 모든 필드에 대해 동일하게 처리
  }
  
  // 3. 병합된 데이터로 업데이트
  await DB.prepare(`UPDATE motorcycles SET ... WHERE id = ?`)
    .bind(...Object.values(mergedData), id)
    .run()
})
```

**개선 사항**:
1. ✅ **부분 업데이트 지원**: 변경할 필드만 보내도 됨
2. ✅ **기존 데이터 보존**: 보내지 않은 필드는 기존 값 유지
3. ✅ **에러 핸들링**: try-catch로 오류 메시지 반환
4. ✅ **404 처리**: 존재하지 않는 ID에 대한 처리

## 🧪 테스트

### 1. 기본정보만 업데이트:
```bash
curl -X PUT "http://localhost:3000/api/motorcycles/1" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: xxx" \
  -d '{
    "vehicle_name": "테스트 수정",
    "mileage": "10000"
  }'
```

**결과**: ✅ 성공 - 다른 필드는 그대로 유지

### 2. 계약정보만 업데이트:
```bash
curl -X PUT "http://localhost:3000/api/motorcycles/1" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: xxx" \
  -d '{
    "monthly_fee": "150000",
    "contract_start_date": "2024-01-01",
    "contract_end_date": "2024-12-31"
  }'
```

**결과**: ✅ 성공 - 기본정보와 보험정보는 그대로 유지

### 3. 보험정보만 업데이트:
```bash
curl -X PUT "http://localhost:3000/api/motorcycles/1" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: xxx" \
  -d '{
    "insurance_company": "현대해상",
    "insurance_start_date": "2024-02-01",
    "insurance_end_date": "2025-01-31"
  }'
```

**결과**: ✅ 성공 - 기본정보와 계약정보는 그대로 유지

## 📱 프론트엔드 사용 예시

### 오토바이 관리 페이지에서:

```javascript
// 기본정보 저장
async function saveBasicInfo() {
  const id = document.getElementById('motorcycleId').value
  const data = {
    plate_number: document.getElementById('plateNumber').value,
    vehicle_name: document.getElementById('vehicleName').value,
    model_year: document.getElementById('modelYear').value,
    mileage: document.getElementById('mileage').value,
    // ... 기본정보만
  }
  
  await axios.put(`/api/motorcycles/${id}`, data)
  // ✅ 계약정보와 보험정보는 변경되지 않음
}

// 계약정보 저장
async function saveContractInfo() {
  const id = document.getElementById('motorcycleId').value
  const data = {
    monthly_fee: document.getElementById('monthlyFee').value,
    contract_type_text: document.getElementById('contractType').value,
    // ... 계약정보만
  }
  
  await axios.put(`/api/motorcycles/${id}`, data)
  // ✅ 기본정보와 보험정보는 변경되지 않음
}

// 보험정보 저장
async function saveInsuranceInfo() {
  const id = document.getElementById('motorcycleId').value
  const data = {
    insurance_company: document.getElementById('insuranceCompany').value,
    insurance_start_date: document.getElementById('insuranceStartDate').value,
    // ... 보험정보만
  }
  
  await axios.put(`/api/motorcycles/${id}`, data)
  // ✅ 기본정보와 계약정보는 변경되지 않음
}
```

## 🎯 수정 가능한 필드 목록

### 기본 정보:
- `plate_number` - 차량번호
- `vehicle_name` - 차량명
- `chassis_number` - 차대번호
- `mileage` - 주행거리
- `model_year` - 연식
- `vehicle_price` - 차량가
- `status` - 상태
- `usage_notes` - 비고
- `certificate_photo` - 증명서 사진

### 계약 정보:
- `monthly_fee` - 월 임대료
- `contract_type_text` - 계약 유형
- `deposit` - 보증금
- `contract_start_date` - 계약 시작일
- `contract_end_date` - 계약 종료일
- `daily_rental_fee` - 일 임대료

### 보험 정보:
- `insurance_company` - 보험사
- `insurance_start_date` - 보험 시작일
- `insurance_end_date` - 보험 종료일
- `insurance_fee` - 보험료
- `driving_range` - 운전 가능 범위
- `owner_name` - 소유자명

### 검사 정보:
- `inspection_start_date` - 검사 시작일
- `inspection_end_date` - 검사 종료일

## 🔒 인증

모든 수정 작업은 **인증이 필요**합니다:
- 헤더: `X-Session-ID: <session_id>`
- 로그인 후 받은 세션 ID 사용

## 📝 응답 형식

### 성공:
```json
{
  "success": true,
  "id": "1",
  "plate_number": "12가3456",
  "vehicle_name": "혼다 PCX 160",
  ...
}
```

### 실패:
```json
{
  "error": "오토바이를 찾을 수 없습니다"
}
```

또는

```json
{
  "error": "수정 중 오류가 발생했습니다: [오류 상세]"
}
```

## 🚀 테스트 URL

https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/motorcycles.html

## 📌 주의사항

1. **세션 필수**: 모든 수정 작업은 로그인 후 세션 ID가 필요합니다
2. **ID 필수**: URL에 오토바이 ID가 포함되어야 합니다
3. **부분 업데이트**: 변경할 필드만 보내면 됩니다
4. **기존 값 유지**: 보내지 않은 필드는 기존 값 그대로 유지됩니다

## 결론

오토바이 수정 API를 **부분 업데이트 지원**으로 개선하여, 기본정보/계약정보/보험정보를 각각 독립적으로 수정할 수 있게 되었습니다. 이제 "수정 실패" 오류 없이 정상적으로 수정할 수 있습니다.
