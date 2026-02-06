# 대시보드 총대여금 카드 제거 및 차용증관리로 이동

## 개요
메인 대시보드에서 총대여금 보라색 카드를 완전히 제거하고, 차용증관리 페이지에만 표시되도록 변경했습니다.

## 변경 사항

### 1. 메인 대시보드 (/)
**제거된 요소**:
- ❌ 총대여금 보라색 카드 (완전 삭제)
- ❌ `totalLoanAmount` 업데이트 코드 (JavaScript)

**남아있는 카드** (4개):
- ✅ 개인계약 (파란색)
- ✅ 업체계약 (초록색)
- ✅ 임시계약 (노란색)
- ✅ 차용증 (주황색)

### 2. 차용증관리 페이지 (/static/loans.html)
**유지된 요소**:
- ✅ 총대여금 카드 (축소 버전)
- ✅ `loadTotalLoanAmount()` 함수
- ✅ 실시간 총대여금 데이터 로드

## 코드 변경 내역

### src/index.tsx (대시보드)

#### 삭제된 HTML 코드:
```html
<!-- 총대여금 -->
<div class="mb-6">
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
</div>
```

#### 삭제된 JavaScript 코드:
```javascript
document.getElementById('totalLoanAmount').textContent = 
    (data.contracts.total_loan_amount || 0).toLocaleString() + '원';
```

### public/static/loans.html (차용증관리)

#### 유지된 코드:
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

```javascript
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

## 화면 구조

### Before (이전)
```
메인 대시보드 (/)
├── 개인계약 (파란색)
├── 업체계약 (초록색)
├── 임시계약 (노란색)
├── 차용증 (주황색)
├── 총대여금 (보라색) ← 제거됨
└── 빠른 액세스
```

### After (현재)
```
메인 대시보드 (/)
├── 개인계약 (파란색)
├── 업체계약 (초록색)
├── 임시계약 (노란색)
├── 차용증 (주황색)
└── 빠른 액세스

차용증관리 (/static/loans.html)
├── 헤더
├── 총대여금 카드 (보라색, 축소) ← 여기로 이동
├── 필터 (상태, 검색)
└── 차용증 목록
```

## 테스트 결과

### 1. 대시보드 총대여금 제거 확인
```bash
✅ curl http://localhost:3000 | grep -c "총대여금"
   → 0 (총대여금 텍스트 없음)
```

### 2. 차용증관리 총대여금 유지 확인
```bash
✅ curl http://localhost:3000/static/loans.html | grep -c "총대여금"
   → 4 (총대여금 관련 코드 4곳에서 확인)
```

### 3. 대시보드 카드 구조 확인
```bash
✅ 개인계약 (activeContracts) - 존재
✅ 업체계약 (businessContracts) - 존재
✅ 임시계약 (tempContracts) - 존재
✅ 차용증 (activeLoans) - 존재
❌ 총대여금 (totalLoanAmount) - 삭제됨
```

## 사용자 흐름

### 총대여금 확인 방법
1. **메인 대시보드에서 차용증 카드 클릭**
   - `/` → `/static/loans.html` 이동

2. **차용증관리 페이지 접속**
   - 페이지 상단에 총대여금 정보 표시
   - 실시간 데이터 로드 (API: `/api/dashboard/stats`)

3. **차용증 관리 작업**
   - 상단의 총대여금을 항상 확인하면서 작업 가능

## 비즈니스 가치

### ✅ 장점
1. **대시보드 정리**: 메인 화면이 더 깔끔하고 집중도 높아짐
2. **컨텍스트 정보**: 차용증 관리 시 총대여금을 항상 확인 가능
3. **공간 효율**: 대시보드 화면 공간 절약

### 📊 UI/UX 개선
- 대시보드: 4개의 계약 카드로 단순화
- 차용증관리: 관련 정보를 한 곳에 집중

## 파일 변경 내역

| 파일 | 변경 내용 | 상태 |
|------|-----------|------|
| `src/index.tsx` | 총대여금 카드 HTML 삭제 | ✅ |
| `src/index.tsx` | totalLoanAmount 업데이트 코드 제거 | ✅ |
| `public/static/loans.html` | 총대여금 카드 유지 | ✅ |

## 테스트 URL

- **메인 대시보드** (총대여금 없음): https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
- **차용증관리** (총대여금 있음): https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans.html

## API 영향

### 변경 없음
- `GET /api/dashboard/stats` 엔드포인트는 그대로 유지
- `total_loan_amount` 데이터는 여전히 응답에 포함
- 차용증관리 페이지에서 계속 사용

### 응답 예시
```json
{
  "motorcycles": { ... },
  "customers": 4,
  "contracts": {
    "active": 2,
    "active_business": 0,
    "active_temp": 0,
    "active_loans": 2,
    "total_loan_amount": 2000000,  ← 차용증관리에서 사용
    "monthly_revenue": 340000,
    "total_deposits": 120000
  }
}
```

## 향후 고려사항

1. **차용증 카드 클릭**: 
   - 현재: 차용증관리 전체 페이지로 이동
   - 고려: 차용증 카드 클릭 시 총대여금 섹션으로 스크롤

2. **빠른 액세스**:
   - 대시보드 "빠른 액세스"에 "차용증 관리" 링크 추가 고려

3. **모바일 최적화**:
   - 차용증관리 페이지 상단 카드 모바일 반응형 개선

---

**작성일**: 2026-02-02
**마지막 업데이트**: 2026-02-02 09:45
**담당자**: AI Developer
