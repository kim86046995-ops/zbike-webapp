# 대시보드 최종 업데이트 - 계약 통계 및 총대여금

## 📅 업데이트 일시
2026-02-02

## 🎯 주요 변경 사항

### 1. 계약 통계 카드 변경
**이전**: 개인계약, 업체계약, 차용증, 총 고객  
**현재**: 개인계약, 업체계약, 임시계약, 차용증 ⭐

#### 새로 추가된 카드
- **임시계약** (노란색, 시계 아이콘)
  - 표시 내용: 활성 임시계약 수
  - 데이터 소스: `contracts` 테이블에서 `status = 'active' AND contract_type = 'temp_rent'`
  - 아이콘: `fa-clock`

#### 삭제된 카드
- ~~총 고객~~ (삭제됨)

### 2. 수익 통계 변경
**이전**: 월 예상 수익 (개인계약 `monthly_fee` 합계)  
**현재**: 총대여금 (차용증 `loan_amount` 합계) ⭐

- **표시 내용**: 활성 차용증의 대여금 총합
- **데이터 소스**: `loan_contracts` 테이블에서 `status = 'active'`인 `loan_amount` 합계
- **크기 축소**: 
  - 패딩: `p-8` → `p-4`
  - 글자 크기: `text-4xl` → `text-2xl`
  - 아이콘 크기: `text-6xl` → `text-3xl`

### 3. 차용증 관리 검색창
- **현재 상태**: 이미 가로 배치로 되어 있음 ✅
- **레이아웃**: 상태 필터(좌측) + 검색창(우측) 가로 배치
- **추가 변경 없음**

## 📊 백엔드 API 업데이트

### GET /api/dashboard/stats

#### 최종 응답 형식
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
    "active": 2,                    // 개인계약
    "monthly_revenue": 340000,
    "total_deposits": 120000,
    "active_business": 0,           // 업체계약
    "active_temp": 0,               // ✨ 임시계약 (새로 추가)
    "active_loans": 2,              // 차용증
    "total_loan_amount": 2000000    // ✨ 총대여금 (새로 추가)
  }
}
```

#### 추가된 SQL 쿼리

**1. 차용증 총대여금 쿼리 (기존 수정)**
```sql
SELECT 
  COUNT(*) as active_loans,
  SUM(CAST(loan_amount as INTEGER)) as total_loan_amount
FROM loan_contracts
WHERE status = 'active'
```

**2. 임시계약 수 쿼리 (새로 추가)**
```sql
SELECT COUNT(*) as active_temp_contracts
FROM contracts
WHERE status = 'active' AND contract_type = 'temp_rent'
```

## 🎨 UI 업데이트

### 대시보드 레이아웃
```
┌─────────────────────────────────────────────────────────┐
│ 오토바이 통계 (4개 카드 - 2x2 그리드)                  │
│ [총바이크2] [사용중0] [휴차중1] [수리중/폐지1]         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 계약 통계 (4개 카드 - 2x2 그리드) ⭐ 업데이트         │
│ [개인계약2] [업체계약0] [임시계약0] [차용증2]          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 총대여금 (축소된 카드) ⭐ 업데이트                      │
│ [총대여금: 2,000,000원]                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 빠른 액세스 (4개 버튼)                                  │
│ [오토바이등록] [계약서작성] [오토바이목록] [계약서목록]│
└─────────────────────────────────────────────────────────┘
```

### 카드 색상 및 아이콘
- **개인계약**: 파란색 (`text-blue-600`) + `fa-file-contract`
- **업체계약**: 초록색 (`text-green-600`) + `fa-building`
- **임시계약**: 노란색 (`text-yellow-600`) + `fa-clock` ⭐
- **차용증**: 주황색 (`text-orange-600`) + `fa-hand-holding-usd`
- **총대여금**: 보라색 그라데이션 (`from-purple-500 to-purple-600`) + `fa-won-sign`

### 총대여금 카드 크기
```html
<!-- 이전: 큰 카드 -->
<div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-8 rounded-xl shadow-lg">
    <p class="text-white text-lg opacity-90">월 예상 수익</p>
    <p id="monthlyRevenue" class="text-4xl font-bold">0원</p>
    <i class="fas fa-won-sign text-6xl opacity-80"></i>
</div>

<!-- 현재: 축소된 카드 -->
<div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-xl shadow-lg">
    <p class="text-white text-sm opacity-90">총대여금</p>
    <p id="totalLoanAmount" class="text-2xl font-bold">0원</p>
    <i class="fas fa-won-sign text-3xl opacity-80"></i>
</div>
```

## 💻 프론트엔드 코드

### JavaScript 업데이트
```javascript
// 계약 통계
document.getElementById('activeContracts').textContent = data.contracts.active;
document.getElementById('businessContracts').textContent = data.contracts.active_business || 0;
document.getElementById('tempContracts').textContent = data.contracts.active_temp || 0;  // ✨ 추가
document.getElementById('activeLoans').textContent = data.contracts.active_loans || 0;
document.getElementById('totalLoanAmount').textContent =  // ✨ 변경
    (data.contracts.total_loan_amount || 0).toLocaleString() + '원';
```

## 🧪 테스트 결과

### API 응답
```bash
curl http://localhost:3000/api/dashboard/stats
```

**실제 결과**:
```json
{
  "motorcycles": { ... },
  "customers": 4,
  "contracts": {
    "active": 2,
    "monthly_revenue": 340000,
    "total_deposits": 120000,
    "active_business": 0,
    "active_temp": 0,          // ✨ 임시계약 0개
    "active_loans": 2,
    "total_loan_amount": 2000000  // ✨ 총대여금 2,000,000원
  }
}
```

### 대시보드 표시
- ✅ 개인계약: 2개
- ✅ 업체계약: 0개
- ✅ 임시계약: 0개 (새로 추가)
- ✅ 차용증: 2개
- ✅ 총대여금: 2,000,000원 (차용증 대여금 합계)

### 차용증 관리 검색창
- ✅ 이미 가로 배치로 되어 있음
- ✅ 추가 변경 불필요

## 📈 비즈니스 가치

### 1. 계약 유형별 완전한 가시성
- **4가지 계약 유형 모두 표시**: 개인계약, 업체계약, 임시계약, 차용증
- **계약 포트폴리오 파악**: 각 계약 유형별 비중 확인
- **사업 다각화 모니터링**: 임시계약 추가로 단기 렌탈 현황 추적

### 2. 총대여금 중심 재무 관리
- **핵심 지표 변경**: 월 예상 수익 → 총대여금
- **차용증 중심**: 차용증 대여금 총액을 명확히 표시
- **채권 관리**: 회수해야 할 총 대여금 한눈에 파악

### 3. UI/UX 개선
- **첫 화면 최적화**: 보라색 카드 크기 축소로 스크롤 없이 모든 정보 표시
- **정보 밀도 향상**: 더 많은 정보를 컴팩트하게 표시
- **핵심 정보 강조**: 불필요한 정보(총 고객) 제거

## 🔧 기술 상세

### TypeScript 타입 (추론)
```typescript
interface DashboardStats {
  motorcycles: {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
    scrapped: number;
  };
  customers: number;
  contracts: {
    active: number;              // 개인계약
    monthly_revenue: number;
    total_deposits: number;
    active_business: number;     // 업체계약
    active_temp: number;         // 임시계약 ⭐
    active_loans: number;        // 차용증
    total_loan_amount: number;   // 총대여금 ⭐
  };
}
```

### 데이터베이스 테이블
1. **contracts**: 개인계약 + 임시계약 (`contract_type = 'temp_rent'`)
2. **business_contracts**: 업체계약
3. **loan_contracts**: 차용증 (`loan_amount` 필드 합산)

## 📝 변경 파일
1. `/home/user/webapp/src/index.tsx`
   - GET /api/dashboard/stats API 수정
   - 대시보드 HTML 레이아웃 수정
   - JavaScript 통계 로드 로직 수정
2. `/home/user/webapp/public/static/loans.html`
   - 검색창 위치 확인 (변경 없음, 이미 최적화됨)

## ✅ 완료 상태
- [x] 임시계약 통계 API 추가
- [x] 총대여금(차용증 금액 합계) API 추가
- [x] 대시보드 계약 카드 4개로 업데이트 (총 고객 삭제, 임시계약 추가)
- [x] 월 예상 수익 → 총대여금으로 변경
- [x] 보라색 카드 크기 축소 (p-8→p-4, text-4xl→text-2xl, text-6xl→text-3xl)
- [x] 차용증 관리 검색창 위치 확인 (이미 최적화됨)

## 🎯 최종 대시보드 구성

### 운영 현황 첫 화면
1. **오토바이 통계** (4개 카드): 총바이크, 사용중, 휴차중, 수리중/폐지
2. **계약 통계** (4개 카드): 개인계약, 업체계약, 임시계약, 차용증
3. **총대여금** (1개 축소 카드): 차용증 대여금 총액
4. **빠른 액세스** (4개 버튼): 주요 기능 바로가기

### 화면 최적화
- **스크롤 없이 모든 정보 표시**: 보라색 카드 축소로 첫 화면에 모든 통계 노출
- **정보 밀도 향상**: 8개 통계 + 1개 총대여금 + 4개 버튼 = 13개 요소를 효율적으로 배치
- **반응형 디자인**: 모바일(2열), 데스크톱(4열)

---
**업데이트 완료**: 2026-02-02  
**테스트 URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/  
**API 테스트**: `curl http://localhost:3000/api/dashboard/stats`
