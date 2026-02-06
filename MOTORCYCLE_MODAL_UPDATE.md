# 오토바이 관리 모달 개편 완료

## 📋 변경 사항 요약

### 1. 3개 섹션으로 구분
기존의 단일 폼을 **3개 섹션**으로 분리하여 정보를 체계적으로 관리:

#### 🔵 기본 정보 (편집 가능)
- **항목**: 차량번호, 차량이름, 년식, 키로수
- **색상**: 파란색 (Blue)
- **수정 버튼**: "기본 정보 수정" - 클릭 시 즉시 저장

#### 🟢 계약 정보 (읽기 전용)
- **항목**: 대여료, 계약종류, 선납/보증금, 계약 시작일, 계약 종료일
- **색상**: 초록색 (Green)
- **자동 입력**: 계약서 작성 시 자동으로 채워짐
- **수정 버튼**: "계약 정보 수정" - 클릭 시 안내 메시지

#### 🟣 보험 정보 (읽기 전용)
- **항목**: 보험사, 명의자, 보험 시작일, 보험 종료일, 보험 운전범위
- **색상**: 보라색 (Purple)
- **자동 입력**: 계약서 작성 시 자동으로 채워짐
- **수정 버튼**: "보험 정보 수정" - 클릭 시 안내 메시지

#### ⚪ 추가 정보 (편집 가능)
- **항목**: 차대번호, 차량금액, 보험료, 검사 시작/종료일, 상태, 사용필증, 사용폐지
- **색상**: 회색 (Gray)

---

## 🔄 데이터 자동 연동

### 기본 정보
- **출처**: 오토바이 등록 시 직접 입력
- **업데이트**: "기본 정보 수정" 버튼으로 즉시 수정 가능

### 계약 정보 자동 입력
**계약서 작성 시 자동으로 다음 정보가 입력됩니다**:

1. **개인 계약** (`/api/contracts`)
   ```javascript
   - 대여료: contract.monthly_fee
   - 계약종류: "개인"
   - 보증금: contract.deposit
   - 계약 시작일: contract.start_date
   - 계약 종료일: contract.end_date
   ```

2. **업체 계약** (`/api/business-contracts`)
   ```javascript
   - 대여료: business_contract.daily_amount
   - 계약종류: "업체"
   - 보증금: business_contract.deposit
   - 계약 시작일: business_contract.contract_start_date
   - 계약 종료일: business_contract.contract_end_date
   ```

3. **임시 렌트** (`/api/temp-rent-contracts`)
   ```javascript
   - 대여료: temp_rent.daily_fee
   - 계약종류: "임시렌트"
   - 보증금: 0
   - 계약 시작일: temp_rent.start_date
   - 계약 종료일: temp_rent.end_date
   ```

### 보험 정보 자동 입력
**계약서 작성 시 자동으로 다음 정보가 입력됩니다**:

1. **개인 계약**에서:
   ```javascript
   - 보험사: contract.insurance_company
   - 명의자: contract.owner_name
   - 보험 시작일: contract.insurance_start_date
   - 보험 종료일: contract.insurance_end_date
   - 보험 운전범위: contract.driving_range
   ```

2. **업체 계약**에서:
   ```javascript
   - 보험사: motorcycle.insurance_company
   - 명의자: motorcycle.owner_name
   - 보험 시작일: business_contract.insurance_start_date
   - 보험 종료일: business_contract.insurance_end_date
   - 보험 운전범위: business_contract.driving_range
   ```

---

## 🎨 UI/UX 개선

### 색상 구분
- **기본 정보**: 파란색 배경 (`bg-blue-50`, `border-blue-200`)
- **계약 정보**: 초록색 배경 (`bg-green-50`, `border-green-200`)
- **보험 정보**: 보라색 배경 (`bg-purple-50`, `border-purple-200`)
- **추가 정보**: 회색 배경 (`bg-gray-50`, `border-gray-200`)

### 입력 필드 상태
- **편집 가능**: 흰색 배경 (`bg-white`)
- **읽기 전용**: 회색 배경 (`bg-gray-100`, `text-gray-600`)

### 버튼 위치
각 섹션 헤더 우측에 수정 버튼 배치:
```html
<div class="flex justify-between items-center mb-4">
    <h3>섹션 제목</h3>
    <button>수정 버튼</button>
</div>
```

---

## 💾 저장 로직

### 1. 기본 정보 저장 (`saveBasicInfo()`)
```javascript
// PUT /api/motorcycles/:id
{
  plate_number,
  vehicle_name,
  model_year,
  mileage,
  chassis_number,
  vehicle_price,
  insurance_fee,
  inspection_start_date,
  inspection_end_date,
  status,
  usage_notes,
  certificate_photo
}
```

### 2. 계약 정보 저장 (`saveContractInfo()`)
- **동작**: 안내 메시지만 표시
- **메시지**: "⚠️ 계약 정보는 계약서 페이지에서만 수정할 수 있습니다."
- **이유**: 계약 정보는 계약서 작성/수정 시 자동으로 업데이트

### 3. 보험 정보 저장 (`saveInsuranceInfo()`)
- **동작**: 안내 메시지만 표시
- **메시지**: "⚠️ 보험 정보는 계약서 페이지에서만 수정할 수 있습니다."
- **이유**: 보험 정보는 계약서 작성/수정 시 자동으로 업데이트

---

## 🔍 데이터 로드 로직

### editMotorcycle(id) 함수 업데이트
```javascript
async function editMotorcycle(id) {
  // 1. 오토바이 기본 정보 로드
  const motorcycle = await GET /api/motorcycles/:id
  
  // 2. 계약 정보 로드
  const contracts = await GET /api/motorcycles/:id/contracts
  const activeContract = contracts.find(c => c.status === 'active')
  
  if (activeContract) {
    // 개인 계약 정보 적용
  } else {
    // 3. 업체 계약 정보 로드
    const businessContracts = await GET /api/business-contracts
    const activeBusiness = businessContracts.find(bc => 
      bc.motorcycle_id === id && bc.status === 'active'
    )
    
    if (activeBusiness) {
      // 업체 계약 정보 적용
    }
  }
}
```

---

## 📝 사용자 워크플로우

### 시나리오 1: 새 오토바이 등록
1. "오토바이 등록" 버튼 클릭
2. **기본 정보** 입력 (차량번호, 차량이름, 년식, 키로수)
3. **추가 정보** 입력 (차대번호, 상태 등)
4. "기본 정보 수정" 버튼으로 저장
5. 계약서 작성 시 **계약 정보**와 **보험 정보** 자동 입력됨

### 시나리오 2: 오토바이 정보 수정
1. 오토바이 카드에서 "수정" 버튼 클릭
2. 3개 섹션으로 구분된 정보 확인
   - 🔵 기본 정보: 편집 가능
   - 🟢 계약 정보: 읽기 전용 (계약서에서 자동 입력)
   - 🟣 보험 정보: 읽기 전용 (계약서에서 자동 입력)
3. **기본 정보**만 수정 후 "기본 정보 수정" 클릭
4. 계약/보험 정보는 계약서 페이지에서 수정

### 시나리오 3: 계약서 작성 후 자동 업데이트
1. 계약서 작성 (개인/업체/임시렌트)
2. 오토바이 정보 자동 업데이트:
   - **계약 정보**: 대여료, 계약종류, 보증금, 기간
   - **보험 정보**: 보험사, 명의자, 보험 기간, 운전범위
3. 오토바이 수정 모달에서 즉시 확인 가능

---

## ✅ 완료 체크리스트

- [x] 모달을 3개 섹션으로 분리 (기본정보, 계약정보, 보험정보)
- [x] 각 섹션에 색상 구분 적용
- [x] 각 섹션에 개별 수정 버튼 추가
- [x] 기본 정보 수정 기능 구현
- [x] 계약 정보 읽기 전용 처리
- [x] 보험 정보 읽기 전용 처리
- [x] 계약서에서 자동 입력 로직 구현
- [x] editMotorcycle 함수에 계약/보험 정보 로드 추가
- [x] 개인 계약 정보 로드
- [x] 업체 계약 정보 로드
- [x] 임시 렌트 정보 로드
- [x] UI/UX 개선 (색상, 레이아웃)

---

## 🚀 배포 상태

- **서버**: ✅ 실행 중 (PM2)
- **URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/motorcycles
- **상태**: 프로덕션 준비 완료

---

## 📸 화면 구성

```
┌─────────────────────────────────────────┐
│         오토바이 수정              [X]  │
├─────────────────────────────────────────┤
│ 🔵 기본 정보         [기본 정보 수정]  │
│ ┌─────────────────────────────────────┐ │
│ │ 차량번호  년식                       │ │
│ │ 차량이름  키로수                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 🟢 계약 정보         [계약 정보 수정]  │
│ ┌─────────────────────────────────────┐ │
│ │ 대여료    선납/보증금   (읽기 전용) │ │
│ │ 계약종류  계약기간      (읽기 전용) │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 🟣 보험 정보         [보험 정보 수정]  │
│ ┌─────────────────────────────────────┐ │
│ │ 보험사    보험시작일   (읽기 전용)  │ │
│ │ 명의자    보험종료일   (읽기 전용)  │ │
│ │          보험운전범위  (읽기 전용)  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ⚪ 추가 정보                           │
│ ┌─────────────────────────────────────┐ │
│ │ 차대번호  보험료                     │ │
│ │ 차량금액  검사기간                   │ │
│ │ 상태      사용필증                   │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│            [닫기]                       │
└─────────────────────────────────────────┘
```

---

**작성일**: 2026-02-02  
**작성자**: Claude  
**버전**: 2.0.0
