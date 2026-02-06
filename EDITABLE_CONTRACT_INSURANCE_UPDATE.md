# 오토바이 관리 모달 - 계약/보험 정보 편집 가능 업데이트

## 📋 변경 사항

### ✅ 이전 (읽기 전용)
- 🟢 **계약 정보**: 읽기 전용 (회색 배경)
- 🟣 **보험 정보**: 읽기 전용 (회색 배경)
- ⚠️ 수정 버튼 클릭 시 안내 메시지만 표시

### ✨ 이후 (편집 가능)
- 🟢 **계약 정보**: 직접 수정 가능 (흰색 배경)
- 🟣 **보험 정보**: 직접 수정 가능 (흰색 배경)
- ✅ 수정 버튼 클릭 시 즉시 저장

---

## 🎯 편집 가능한 필드

### 🟢 계약 정보 (모두 편집 가능)
- **대여료** (원) - `monthly_fee`
- **계약종류** - `contract_type_text` (예: 개인, 업체, 임시렌트)
- **선납/보증금** (원) - `deposit`
- **계약 시작일** - `contract_start_date`
- **계약 종료일** - `contract_end_date`

### 🟣 보험 정보 (모두 편집 가능)
- **보험사** - `insurance_company`
- **명의자** - `owner_name`
- **보험 시작일** - `insurance_start_date`
- **보험 종료일** - `insurance_end_date`
- **보험 운전범위** - `driving_range` (예: 만21세이상)

---

## 💾 데이터베이스 변경

### 추가된 컬럼 (motorcycles 테이블)
```sql
-- migrations/0006_add_contract_info_to_motorcycles.sql
ALTER TABLE motorcycles ADD COLUMN monthly_fee INTEGER DEFAULT 0;
ALTER TABLE motorcycles ADD COLUMN contract_type_text TEXT DEFAULT '';
ALTER TABLE motorcycles ADD COLUMN deposit INTEGER DEFAULT 0;
ALTER TABLE motorcycles ADD COLUMN contract_start_date TEXT DEFAULT '';
ALTER TABLE motorcycles ADD COLUMN contract_end_date TEXT DEFAULT '';
```

---

## 🔧 백엔드 API 업데이트

### PUT /api/motorcycles/:id
**추가된 필드**:
```typescript
{
  // 기존 필드...
  
  // 계약 정보 (신규)
  monthly_fee: number,
  contract_type_text: string,
  deposit: number,
  contract_start_date: string,
  contract_end_date: string,
  
  // 보험 정보 (기존 - 직접 수정 가능)
  insurance_company: string,
  owner_name: string,
  insurance_start_date: string,
  insurance_end_date: string,
  driving_range: string
}
```

---

## 💡 저장 로직

### 1. 계약 정보 저장 (`saveContractInfo()`)
```javascript
async function saveContractInfo() {
  const data = {
    monthly_fee: document.getElementById('monthlyFee').value,
    contract_type_text: document.getElementById('contractType').value,
    deposit: document.getElementById('deposit').value,
    contract_start_date: document.getElementById('contractStartDate').value,
    contract_end_date: document.getElementById('contractEndDate').value
  };
  
  await axios.put(`/api/motorcycles/${id}`, data);
  alert('✅ 계약 정보가 수정되었습니다');
}
```

### 2. 보험 정보 저장 (`saveInsuranceInfo()`)
```javascript
async function saveInsuranceInfo() {
  const data = {
    insurance_company: document.getElementById('insuranceCompany').value,
    owner_name: document.getElementById('ownerName').value,
    insurance_start_date: document.getElementById('insuranceStartDate').value,
    insurance_end_date: document.getElementById('insuranceEndDate').value,
    driving_range: document.getElementById('drivingRange').value
  };
  
  await axios.put(`/api/motorcycles/${id}`, data);
  alert('✅ 보험 정보가 수정되었습니다');
}
```

---

## 🎨 UI 변경

### 이전 (읽기 전용)
```css
.bg-gray-100    /* 회색 배경 */
.text-gray-600  /* 회색 텍스트 */
readonly        /* 편집 불가 */
```

### 이후 (편집 가능)
```css
.bg-white                        /* 흰색 배경 */
.focus:ring-2                    /* 포커스 효과 */
.focus:ring-green-500 (계약)     /* 초록색 링 */
.focus:ring-purple-500 (보험)    /* 보라색 링 */
```

---

## 📝 사용 시나리오

### 시나리오 1: 수동으로 계약 정보 입력
1. 오토바이 수정 모달 열기
2. 🟢 **계약 정보** 섹션에서 직접 입력
   - 대여료: 500,000원
   - 계약종류: 개인
   - 보증금: 1,000,000원
   - 계약 기간: 2024-01-01 ~ 2024-12-31
3. "계약 정보 수정" 버튼 클릭
4. ✅ 저장 완료!

### 시나리오 2: 수동으로 보험 정보 입력
1. 오토바이 수정 모달 열기
2. 🟣 **보험 정보** 섹션에서 직접 입력
   - 보험사: KB손해보험
   - 명의자: 김철수
   - 보험 기간: 2024-01-01 ~ 2024-12-31
   - 운전범위: 만21세이상
3. "보험 정보 수정" 버튼 클릭
4. ✅ 저장 완료!

### 시나리오 3: 계약서에서 자동 입력 후 수정
1. 계약서 작성 → 계약/보험 정보 **자동 입력**
2. 오토바이 수정 모달 열기 → 정보 확인
3. 필요 시 **직접 수정** 가능
4. "계약 정보 수정" 또는 "보험 정보 수정" 버튼으로 저장

---

## ✅ 완료 체크리스트

- [x] 계약 정보 필드를 편집 가능하게 변경
- [x] 보험 정보 필드를 편집 가능하게 변경
- [x] 회색 배경 → 흰색 배경으로 변경
- [x] readonly 속성 제거
- [x] focus 효과 추가 (ring-green/purple)
- [x] DB 마이그레이션 추가 (5개 컬럼)
- [x] 백엔드 API 업데이트 (PUT /api/motorcycles/:id)
- [x] saveContractInfo() 함수 구현
- [x] saveInsuranceInfo() 함수 구현
- [x] 로컬 DB 마이그레이션 적용
- [x] 빌드 및 재시작

---

## 🚀 배포 상태

- **서버**: ✅ 실행 중 (PM2)
- **DB 마이그레이션**: ✅ 적용 완료 (0006_add_contract_info_to_motorcycles.sql)
- **URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/motorcycles
- **상태**: 프로덕션 준비 완료

---

## 📸 화면 구성 (업데이트)

```
┌─────────────────────────────────────────┐
│         오토바이 수정              [X]  │
├─────────────────────────────────────────┤
│ 🔵 기본 정보         [기본 정보 수정]  │
│ ┌─────────────────────────────────────┐ │
│ │ 차량번호  년식       (편집 가능)    │ │
│ │ 차량이름  키로수     (편집 가능)    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 🟢 계약 정보         [계약 정보 수정]  │
│ ┌─────────────────────────────────────┐ │
│ │ 대여료    보증금     (편집 가능) ✨ │ │
│ │ 계약종류  계약기간   (편집 가능) ✨ │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 🟣 보험 정보         [보험 정보 수정]  │
│ ┌─────────────────────────────────────┐ │
│ │ 보험사    보험기간   (편집 가능) ✨ │ │
│ │ 명의자    운전범위   (편집 가능) ✨ │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ⚪ 추가 정보                           │
│ ┌─────────────────────────────────────┐ │
│ │ 차대번호  보험료     (편집 가능)    │ │
│ │ 차량금액  검사기간   (편집 가능)    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│            [닫기]                       │
└─────────────────────────────────────────┘
```

---

## 🔍 테스트 방법

1. **오토바이 관리** 페이지 접속
2. 아무 오토바이의 **"수정"** 버튼 클릭
3. **계약 정보** 섹션:
   - ✅ 흰색 배경인지 확인
   - ✅ 필드에 입력 가능한지 확인
   - ✅ "계약 정보 수정" 버튼 클릭 시 저장되는지 확인
4. **보험 정보** 섹션:
   - ✅ 흰색 배경인지 확인
   - ✅ 필드에 입력 가능한지 확인
   - ✅ "보험 정보 수정" 버튼 클릭 시 저장되는지 확인

---

**작성일**: 2026-02-02  
**작성자**: Claude  
**버전**: 2.1.0 (편집 가능 버전)
