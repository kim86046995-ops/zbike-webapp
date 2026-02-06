# 대시보드 계약 통계 업데이트 (업체계약/차용증 추가)

## 📅 업데이트 일시
2026-02-02

## 🎯 주요 변경 사항

### 1. 통계 카드 레이아웃 변경
- **이전**: 3열 그리드 (활성 계약, 총 고객, 월 예상 수익)
- **현재**: 4열 그리드 (개인계약, 업체계약, 차용증, 총 고객) + 수익 통계 별도

### 2. 새로운 통계 항목

#### 개인계약 (파란색, 파일 아이콘)
- **표시 내용**: 활성 개인계약 수
- **데이터 소스**: `contracts` 테이블에서 `status = 'active'`
- **아이콘**: `fa-file-contract`

#### 업체계약 (초록색, 빌딩 아이콘)
- **표시 내용**: 활성 업체계약 수
- **데이터 소스**: `business_contracts` 테이블에서 `status = 'active'`
- **아이콘**: `fa-building`

#### 차용증 (주황색, 손 아이콘)
- **표시 내용**: 활성 차용증 수
- **데이터 소스**: `loan_contracts` 테이블에서 `status = 'active'`
- **아이콘**: `fa-hand-holding-usd`

#### 총 고객 (보라색, 사람들 아이콘)
- **표시 내용**: 총 고객 수
- **데이터 소스**: `contracts` 테이블에서 고유 `customer_id` 수
- **아이콘**: `fa-users`

### 3. 수익 통계 (별도 섹션)
- **레이아웃**: 전체 너비 그라데이션 카드 (보라색)
- **표시 내용**: 월 예상 수익 (개인계약의 `monthly_fee` 합계)
- **아이콘**: `fa-won-sign` (큰 사이즈)

## 📊 백엔드 API 변경

### GET /api/dashboard/stats

#### 업데이트된 응답 형식
```json
{
  "motorcycles": {
    "total": 2,
    "available": 1,
    "rented": 0,
    "maintenance": 0,
    "scrapped": 1
  },
  "customers": 4,
  "contracts": {
    "active": 2,                    // 개인계약 수
    "monthly_revenue": 340000,
    "total_deposits": 120000,
    "active_business": 0,           // ✨ 새로 추가
    "active_loans": 2               // ✨ 새로 추가
  }
}
```

#### 추가된 SQL 쿼리
```typescript
// 활성 업체계약 수
const businessContractStats = await DB.prepare(`
  SELECT COUNT(*) as active_business_contracts
  FROM business_contracts
  WHERE status = 'active'
`).first()

// 활성 차용증 수
const loanStats = await DB.prepare(`
  SELECT COUNT(*) as active_loans
  FROM loan_contracts
  WHERE status = 'active'
`).first()
```

## 🎨 UI 디자인

### 통계 카드 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  오토바이 통계 (4개 카드 - 2x2 그리드)                      │
│  [총바이크]  [사용중]  [휴차중]  [수리중/폐지]              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  계약 통계 (4개 카드 - 2x2 그리드)                          │
│  [개인계약]  [업체계약]  [차용증]  [총 고객]                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  수익 통계 (전체 너비 그라데이션 카드)                      │
│  [월 예상 수익: 340,000원]                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  빠른 액세스 (4개 버튼)                                      │
│  [오토바이 등록]  [계약서 작성]  [오토바이 목록]  [계약서 목록] │
└─────────────────────────────────────────────────────────────┘
```

### 카드 색상
- **개인계약**: 파란색 (`text-blue-600`)
- **업체계약**: 초록색 (`text-green-600`)
- **차용증**: 주황색 (`text-orange-600`)
- **총 고객**: 보라색 (`text-purple-600`)
- **월 예상 수익**: 보라색 그라데이션 (`from-purple-500 to-purple-600`)

### 반응형 디자인
- **모바일**: 2열 그리드
- **데스크톱**: 4열 그리드
- **수익 통계**: 항상 전체 너비

## 💻 프론트엔드 코드

### HTML 구조
```html
<!-- 계약 통계 -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <!-- 개인계약 -->
    <div class="bg-white p-6 rounded-xl shadow-md">
        <p class="text-gray-600 text-sm">개인계약</p>
        <p id="activeContracts" class="text-2xl font-bold">0</p>
        <i class="fas fa-file-contract text-blue-600"></i>
    </div>
    
    <!-- 업체계약 -->
    <div class="bg-white p-6 rounded-xl shadow-md">
        <p class="text-gray-600 text-sm">업체계약</p>
        <p id="businessContracts" class="text-2xl font-bold">0</p>
        <i class="fas fa-building text-green-600"></i>
    </div>
    
    <!-- 차용증 -->
    <div class="bg-white p-6 rounded-xl shadow-md">
        <p class="text-gray-600 text-sm">차용증</p>
        <p id="activeLoans" class="text-2xl font-bold">0</p>
        <i class="fas fa-hand-holding-usd text-orange-600"></i>
    </div>
    
    <!-- 총 고객 -->
    <div class="bg-white p-6 rounded-xl shadow-md">
        <p class="text-gray-600 text-sm">총 고객</p>
        <p id="totalCustomers" class="text-2xl font-bold">0</p>
        <i class="fas fa-users text-purple-600"></i>
    </div>
</div>

<!-- 수익 통계 -->
<div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-8">
    <p class="text-white text-lg">월 예상 수익</p>
    <p id="monthlyRevenue" class="text-4xl font-bold">0원</p>
    <i class="fas fa-won-sign text-6xl"></i>
</div>
```

### JavaScript 업데이트
```javascript
// 계약 통계
document.getElementById('activeContracts').textContent = data.contracts.active;
document.getElementById('businessContracts').textContent = data.contracts.active_business || 0;
document.getElementById('activeLoans').textContent = data.contracts.active_loans || 0;
document.getElementById('totalCustomers').textContent = data.customers;
document.getElementById('monthlyRevenue').textContent = 
    (data.contracts.monthly_revenue || 0).toLocaleString() + '원';
```

## 🧪 테스트

### 1. API 테스트
```bash
curl http://localhost:3000/api/dashboard/stats
```

**예상 결과**:
```json
{
  "motorcycles": { ... },
  "customers": 4,
  "contracts": {
    "active": 2,
    "monthly_revenue": 340000,
    "total_deposits": 120000,
    "active_business": 0,
    "active_loans": 2
  }
}
```

### 2. 대시보드 접속
- **URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
- **확인 사항**:
  - 개인계약: 2개
  - 업체계약: 0개
  - 차용증: 2개
  - 총 고객: 4명
  - 월 예상 수익: 340,000원

### 3. 시각적 확인
- 4개의 계약 통계 카드가 2x2 그리드로 표시
- 각 카드의 색상과 아이콘이 올바르게 표시
- 수익 통계가 전체 너비 그라데이션 카드로 표시
- 모바일에서 2열, 데스크톱에서 4열로 반응형 동작

## 📈 비즈니스 가치

### 1. 계약 유형별 가시성
- 개인계약, 업체계약, 차용증을 한눈에 파악
- 각 계약 유형별 비중 확인 가능
- 사업 다각화 현황 모니터링

### 2. 고객 관리
- 총 고객 수 실시간 추적
- 고객 증가 추세 파악

### 3. 수익 가시화
- 월 예상 수익을 큰 카드로 강조
- 핵심 비즈니스 지표로 부각

## 🔧 기술 스택
- **프론트엔드**: HTML, Tailwind CSS, Axios, Font Awesome
- **백엔드**: Hono (Cloudflare Workers)
- **데이터베이스**: Cloudflare D1 (SQLite)
  - `contracts` 테이블: 개인계약
  - `business_contracts` 테이블: 업체계약
  - `loan_contracts` 테이블: 차용증

## 📝 변경 파일
1. `/home/user/webapp/src/index.tsx`
   - GET /api/dashboard/stats 업데이트
   - 대시보드 HTML 레이아웃 변경
   - JavaScript 통계 로드 로직 수정

## ✅ 완료 상태
- [x] 업체계약 통계 API 추가
- [x] 차용증 통계 API 추가
- [x] 대시보드 UI 4개 카드로 변경
- [x] 수익 통계 별도 섹션으로 분리
- [x] 반응형 디자인 적용 (2x2 그리드)
- [x] 아이콘 및 색상 지정
- [x] JavaScript 로직 업데이트

## 🎯 다음 단계
1. 각 계약 카드 클릭 시 해당 계약 목록으로 이동
2. 시간대별/월별 통계 추가
3. 차트로 시각화 (Chart.js)
4. 계약 유형별 수익 비교

---
**업데이트 완료**: 2026-02-02
**테스트 URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
