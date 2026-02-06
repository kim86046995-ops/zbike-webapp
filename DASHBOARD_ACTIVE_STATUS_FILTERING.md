# 대시보드 계약 카드 - 진행중 필터링 추가

## 📅 업데이트 일시
2026-02-02

## 🎯 주요 변경 사항

### 1. 상태 필터 추가 (진행중만 표시)
대시보드에서 계약 카드 클릭 시 **해당 계약 유형 + 진행중 상태**만 표시되도록 수정

#### 변경 내용
- **이전**: 계약 유형만 필터링 (모든 상태 표시)
- **현재**: 계약 유형 + 진행중 상태 필터링 (active만 표시) ⭐

### 2. URL 파라미터 업데이트

#### 개인계약 카드 클릭
```
이전: /static/contracts.html?type=personal
현재: /static/contracts.html?type=personal&status=active ⭐
결과: 개인계약 진행중만 표시
```

#### 업체계약 카드 클릭
```
이전: /static/contracts.html?type=business
현재: /static/contracts.html?type=business&status=active ⭐
결과: 업체계약 진행중만 표시
```

#### 임시계약 카드 클릭
```
이전: /static/contracts.html?type=temp
현재: /static/contracts.html?type=temp&status=active ⭐
결과: 임시계약 진행중만 표시
```

#### 차용증 카드 클릭
```
변경 없음: /static/loans.html
결과: 전체 차용증 목록 표시
```

## 💻 코드 구현

### 1. 대시보드 JavaScript 수정

#### filterByContractType 함수 업데이트
```javascript
// 계약 유형별 필터링 (계약서 관리 페이지로 이동)
function filterByContractType(type) {
    if (type === 'personal') {
        // 개인계약 진행중만 표시
        window.location.href = '/static/contracts.html?type=personal&status=active';
    } else if (type === 'business') {
        // 업체계약 진행중만 표시
        window.location.href = '/static/contracts.html?type=business&status=active';
    } else if (type === 'temp') {
        // 임시계약 진행중만 표시
        window.location.href = '/static/contracts.html?type=temp&status=active';
    } else if (type === 'loan') {
        // 차용증 페이지로 이동
        window.location.href = '/static/loans.html';
    }
}
```

### 2. contracts.html URL 파라미터 처리

#### status 파라미터 추가 처리
```javascript
window.addEventListener('DOMContentLoaded', async () => {
    if (await checkAuth()) {
        // URL 파라미터로 전달된 계약 유형 및 상태 필터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const typeParam = urlParams.get('type');
        const statusParam = urlParams.get('status'); // ⭐ 추가
        
        // 계약 유형 필터 설정
        if (typeParam) {
            const typeFilterElement = document.getElementById('typeFilter');
            if (typeParam === 'personal') {
                typeFilterElement.value = 'personal';
            } else if (typeParam === 'business') {
                typeFilterElement.value = 'business';
            } else if (typeParam === 'temp') {
                typeFilterElement.value = 'temp_rent';
            }
        }
        
        // 상태 필터 설정 ⭐ 추가
        if (statusParam) {
            const statusFilterElement = document.getElementById('statusFilter');
            statusFilterElement.value = statusParam;
        }
        
        loadContracts();
    }
});
```

## 📊 사용자 플로우

### 1. 개인계약 카드 클릭
```
대시보드 (/)
  ↓ 클릭: 개인계약 카드 (2개)
계약서 관리 (/static/contracts.html?type=personal&status=active)
  ↓ 자동 필터 적용
  - 계약 유형: 개인계약
  - 상태: 진행중
  ↓ 결과
개인계약 진행중 2개만 표시 ✅
```

### 2. 업체계약 카드 클릭
```
대시보드 (/)
  ↓ 클릭: 업체계약 카드 (0개)
계약서 관리 (/static/contracts.html?type=business&status=active)
  ↓ 자동 필터 적용
  - 계약 유형: 업체계약
  - 상태: 진행중
  ↓ 결과
업체계약 진행중 0개 (빈 목록) ✅
```

### 3. 임시계약 카드 클릭
```
대시보드 (/)
  ↓ 클릭: 임시계약 카드 (0개)
계약서 관리 (/static/contracts.html?type=temp&status=active)
  ↓ 자동 필터 적용
  - 계약 유형: 임시렌트
  - 상태: 진행중
  ↓ 결과
임시계약 진행중 0개 (빈 목록) ✅
```

### 4. 차용증 카드 클릭
```
대시보드 (/)
  ↓ 클릭: 차용증 카드 (2개)
차용증 관리 (/static/loans.html)
  ↓ 페이지 이동
전체 차용증 목록 표시 ✅
```

## 🧪 테스트

### 1. URL 파라미터 확인
```bash
# 대시보드 HTML에서 status=active 확인 (3개: 개인, 업체, 임시)
curl -s http://localhost:3000 | grep -o "status=active" | wc -l
# 출력: 3 ✅
```

### 2. 필터링 동작 테스트

#### 개인계약 테스트
1. 대시보드 접속
2. 개인계약 카드 클릭
3. URL 확인: `/static/contracts.html?type=personal&status=active`
4. 계약 유형 필터: "개인계약" 선택됨
5. 상태 필터: "진행중" 선택됨
6. 결과: 개인계약 진행중만 표시 ✅

#### 업체계약 테스트
1. 대시보드 접속
2. 업체계약 카드 클릭
3. URL 확인: `/static/contracts.html?type=business&status=active`
4. 계약 유형 필터: "업체계약" 선택됨
5. 상태 필터: "진행중" 선택됨
6. 결과: 업체계약 진행중만 표시 ✅

#### 임시계약 테스트
1. 대시보드 접속
2. 임시계약 카드 클릭
3. URL 확인: `/static/contracts.html?type=temp&status=active`
4. 계약 유형 필터: "임시렌트" 선택됨
5. 상태 필터: "진행중" 선택됨
6. 결과: 임시계약 진행중만 표시 ✅

## 📈 비즈니스 가치

### 1. 정확한 정보 제공
- **진행중 계약만 표시**: 대시보드 통계와 일치하는 결과
- **종료된 계약 제외**: 현재 활성 계약에만 집중
- **데이터 정합성**: 통계 수치와 목록이 정확히 일치

### 2. 사용자 경험 향상
- **예상된 결과**: 사용자가 기대하는 대로 동작
- **혼란 방지**: 종료된 계약이 섞여 나오지 않음
- **빠른 의사결정**: 현재 진행중인 계약만 즉시 파악

### 3. 워크플로우 최적화
- **원클릭 접근**: 대시보드 → 진행중 계약 목록
- **필터 재설정 불필요**: 자동으로 적절한 필터 적용
- **업무 효율성**: 관리자가 현재 관리 중인 계약에만 집중

## 🔍 상세 동작

### URL 파라미터 매핑 테이블

| 대시보드 카드 | URL 파라미터 | 계약 유형 필터 값 | 상태 필터 값 | 표시 결과 |
|---------------|--------------|-------------------|--------------|-----------|
| 개인계약 (2) | `type=personal&status=active` | `personal` | `active` | 개인계약 진행중 2개 |
| 업체계약 (0) | `type=business&status=active` | `business` | `active` | 업체계약 진행중 0개 |
| 임시계약 (0) | `type=temp&status=active` | `temp_rent` | `active` | 임시계약 진행중 0개 |
| 차용증 (2) | (없음) | (없음) | (없음) | 전체 차용증 2개 |

### contracts.html 필터 동작
```javascript
// URL: /static/contracts.html?type=personal&status=active

1. URL 파라미터 읽기
   - type = 'personal'
   - status = 'active'

2. 필터 설정
   - typeFilter.value = 'personal'
   - statusFilter.value = 'active'

3. loadContracts() 호출
   → filterContracts() 호출
   → 개인계약 + 진행중만 필터링
   → renderContracts() 호출
   
4. 결과 표시
   → 개인계약 진행중 목록만 렌더링
```

## 📝 변경 파일
1. `/home/user/webapp/src/index.tsx`
   - filterByContractType 함수: URL에 `&status=active` 추가
2. `/home/user/webapp/public/static/contracts.html`
   - DOMContentLoaded: statusParam 처리 로직 추가

## ✅ 완료 상태
- [x] 개인계약 카드: `&status=active` 파라미터 추가
- [x] 업체계약 카드: `&status=active` 파라미터 추가
- [x] 임시계약 카드: `&status=active` 파라미터 추가
- [x] contracts.html: status 파라미터 처리 로직 추가
- [x] 자동 필터 설정: 계약 유형 + 상태 동시 적용
- [x] 테스트 완료: 3개 카드 모두 status=active 포함

## 🎯 상태 필터 값

### contracts.html 상태 필터 옵션
```html
<select id="statusFilter">
    <option value="">전체</option>
    <option value="active">진행중</option>      ← 선택됨
    <option value="completed">완료</option>
    <option value="cancelled">취소</option>
</select>
```

### URL 파라미터 → 필터 값 매핑
```
URL: ?status=active
  ↓
statusFilter.value = 'active'
  ↓
진행중 계약만 표시
```

## 🔄 전체 필터링 흐름

```
사용자 클릭
  ↓
filterByContractType('personal')
  ↓
URL 생성: /static/contracts.html?type=personal&status=active
  ↓
페이지 이동
  ↓
DOMContentLoaded 이벤트
  ↓
URL 파라미터 읽기
  - typeParam = 'personal'
  - statusParam = 'active'
  ↓
필터 설정
  - typeFilter.value = 'personal'
  - statusFilter.value = 'active'
  ↓
loadContracts()
  ↓
filterContracts() (두 필터 모두 적용)
  ↓
renderContracts()
  ↓
개인계약 진행중만 표시 ✅
```

---
**업데이트 완료**: 2026-02-02  
**테스트 URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/  
**테스트 방법**: 
1. 대시보드 접속
2. 개인계약 카드 클릭
3. URL에 `&status=active` 포함 확인
4. 진행중 상태 필터 자동 선택 확인
5. 개인계약 진행중만 표시 확인
