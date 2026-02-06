# 총대여금 카드 이동 업데이트

## 개요
메인 대시보드의 총대여금 보라색 카드를 클릭하면 차용증관리 페이지로 이동하고, 차용증관리 페이지 상단에 축소된 총대여금 카드가 표시되도록 구현했습니다.

## 구현 내용

### 1. 대시보드 총대여금 카드
**위치**: `/` (메인 대시보드)

**변경사항**:
- 총대여금 카드에 클릭 이벤트 추가
- 클릭 시 `/static/loans.html` (차용증관리)로 이동
- 호버 효과 추가 (shadow-xl, scale-105)

```html
<div onclick="window.location.href='/static/loans.html'" 
     class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 text-white 
            cursor-pointer hover:shadow-xl hover:scale-105 transition-all">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm opacity-90 mb-1">
        <i class="fas fa-won-sign mr-1"></i>
        총대여금
      </p>
      <p id="totalLoanAmount" class="text-3xl font-bold">0원</p>
    </div>
    <i class="fas fa-hand-holding-usd text-4xl opacity-20"></i>
  </div>
</div>
```

### 2. 차용증관리 페이지 축소 카드
**위치**: `/static/loans.html`

**새로 추가된 요소**:
- 헤더 바로 아래, 필터 영역 위에 축소된 총대여금 카드 추가
- 크기와 패딩을 축소하여 공간 절약 (p-4 → p-3, text-3xl → text-xl, text-4xl → text-2xl)

```html
<!-- 총대여금 카드 (축소 버전) -->
<div class="container mx-auto px-4 pt-4">
    <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-3 text-white">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-xs opacity-90 mb-1">
                    <i class="fas fa-won-sign mr-1"></i>
                    총대여금
                </p>
                <p id="totalLoanAmount" class="text-xl font-bold">0원</p>
            </div>
            <i class="fas fa-hand-holding-usd text-2xl opacity-20"></i>
        </div>
    </div>
</div>
```

### 3. 데이터 로드
**파일**: `/home/user/webapp/public/static/loans.html`

**새로 추가된 함수**:
```javascript
// 총대여금 로드
async function loadTotalLoanAmount() {
    try {
        const response = await axios.get('/api/dashboard/stats');
        const totalAmount = response.data.contracts?.total_loan_amount || 0;
        document.getElementById('totalLoanAmount').textContent = totalAmount.toLocaleString() + '원';
    } catch (error) {
        console.error('총대여금 로드 실패:', error);
    }
}
```

**페이지 로드 시 실행**:
```javascript
window.addEventListener('DOMContentLoaded', () => {
    loadLoans();
    loadTotalLoanAmount();
});
```

## 디자인 변경사항

### 대시보드 카드 (원본 크기)
- **패딩**: p-4
- **텍스트 크기**: text-sm (라벨), text-3xl (금액)
- **아이콘 크기**: text-4xl
- **커서**: cursor-pointer
- **호버 효과**: hover:shadow-xl, hover:scale-105

### 차용증관리 카드 (축소 버전)
- **패딩**: p-3 (25% 감소)
- **텍스트 크기**: text-xs (라벨), text-xl (금액)
- **아이콘 크기**: text-2xl
- **위치**: 헤더와 필터 영역 사이 (pt-4로 간격 조정)

## 사용자 흐름

1. **대시보드에서 출발**:
   - 사용자가 메인 대시보드(`/`)에 접속
   - 총대여금 보라색 카드 확인

2. **카드 클릭**:
   - 총대여금 카드 클릭
   - 자동으로 `/static/loans.html`로 이동

3. **차용증관리 페이지**:
   - 페이지 상단(헤더 아래)에 축소된 총대여금 카드 표시
   - 총대여금 금액이 자동으로 로드됨 (API 호출)

## API 엔드포인트

### GET /api/dashboard/stats
**응답 예시**:
```json
{
  "motorcycles": { ... },
  "customers": 4,
  "contracts": {
    "active": 2,
    "active_business": 0,
    "active_temp": 0,
    "active_loans": 2,
    "total_loan_amount": 2000000,
    "monthly_revenue": 340000,
    "total_deposits": 120000
  }
}
```

**사용 데이터**: `contracts.total_loan_amount` (차용증 총 대여금)

## 테스트 결과

### 1. 대시보드 클릭 이벤트
```bash
✅ onclick="window.location.href='/static/loans.html'" 확인됨
```

### 2. 차용증관리 카드 표시
```bash
✅ <!-- 총대여금 카드 (축소 버전) --> 확인됨
✅ bg-gradient-to-br from-purple-500 to-purple-600 스타일 확인됨
```

### 3. 데이터 로드
```bash
✅ loadTotalLoanAmount() 함수 정의 확인됨
✅ DOMContentLoaded 이벤트에서 호출 확인됨
```

## 파일 변경 내역

### 백엔드
- **src/index.tsx**: 대시보드 총대여금 카드에 클릭 이벤트 추가

### 프론트엔드
- **public/static/loans.html**: 
  - 축소된 총대여금 카드 추가
  - `loadTotalLoanAmount()` 함수 추가
  - DOMContentLoaded 이벤트 핸들러 수정

## 테스트 URL

- **대시보드**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
- **차용증관리** (총대여금 카드 포함): https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans.html

## 비즈니스 가치

1. **사용자 경험 개선**: 
   - 대시보드에서 원클릭으로 차용증관리 접근
   - 차용증관리 페이지에서도 총대여금 정보를 항상 확인 가능

2. **시각적 일관성**: 
   - 동일한 보라색 그라데이션 디자인 유지
   - 축소된 버전으로 공간 효율적 활용

3. **데이터 접근성**: 
   - 실시간 총대여금 정보를 두 페이지에서 모두 제공
   - 별도 페이지 이동 없이 정보 확인 가능

## 향후 개선 가능 사항

1. **자동 갱신**: 차용증 등록/수정 시 총대여금 자동 업데이트
2. **애니메이션**: 카드 전환 시 부드러운 애니메이션 효과
3. **상세 정보**: 총대여금 카드 클릭 시 상세 분석 모달 표시
4. **필터 연동**: 총대여금 카드에 기간별 필터 기능 추가

---

**작성일**: 2026-02-02
**마지막 업데이트**: 2026-02-02 09:40
**담당자**: AI Developer
