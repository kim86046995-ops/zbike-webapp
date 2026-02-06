# 대시보드 계약 카드 클릭 필터링 기능

## 📅 업데이트 일시
2026-02-02

## 🎯 주요 변경 사항

### 1. 계약 카드 클릭 이벤트 추가
대시보드의 4개 계약 카드에 클릭 시 해당 계약서 목록 페이지로 이동하는 기능 추가

#### 클릭 가능한 카드
1. **개인계약** → `/static/contracts.html?type=personal`
2. **업체계약** → `/static/contracts.html?type=business`
3. **임시계약** → `/static/contracts.html?type=temp`
4. **차용증** → `/static/loans.html`

### 2. UI/UX 개선
- **cursor-pointer**: 카드에 마우스 오버 시 포인터 커서 표시
- **hover:shadow-lg**: 호버 시 그림자 효과 강화
- **hover:scale-105**: 호버 시 5% 확대 효과
- **transition-all**: 부드러운 전환 애니메이션

### 3. contracts.html 필터링 기능
URL 파라미터를 읽어서 자동으로 계약 유형 필터 적용

## 💻 코드 구현

### 1. 대시보드 HTML 업데이트

#### 카드 클릭 이벤트 추가
```html
<!-- 개인 계약 -->
<div class="bg-white p-6 rounded-xl shadow-md cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
     onclick="filterByContractType('personal')">
    <p class="text-gray-600 text-sm">개인계약</p>
    <p id="activeContracts" class="text-2xl font-bold">0</p>
    <i class="fas fa-file-contract text-blue-600"></i>
</div>

<!-- 업체 계약 -->
<div class="... cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
     onclick="filterByContractType('business')">
    ...
</div>

<!-- 임시계약 -->
<div class="... cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
     onclick="filterByContractType('temp')">
    ...
</div>

<!-- 차용증 -->
<div class="... cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
     onclick="filterByContractType('loan')">
    ...
</div>
```

### 2. JavaScript 함수 추가

#### filterByContractType 함수
```javascript
// 계약 유형별 필터링 (계약서 관리 페이지로 이동)
function filterByContractType(type) {
    if (type === 'personal') {
        // 개인계약 페이지로 이동
        window.location.href = '/static/contracts.html?type=personal';
    } else if (type === 'business') {
        // 업체계약 페이지로 이동
        window.location.href = '/static/contracts.html?type=business';
    } else if (type === 'temp') {
        // 임시계약 페이지로 이동
        window.location.href = '/static/contracts.html?type=temp';
    } else if (type === 'loan') {
        // 차용증 페이지로 이동
        window.location.href = '/static/loans.html';
    }
}
```

### 3. contracts.html URL 파라미터 처리

#### DOMContentLoaded에서 URL 파라미터 읽기
```javascript
window.addEventListener('DOMContentLoaded', async () => {
    if (await checkAuth()) {
        // URL 파라미터로 전달된 계약 유형 필터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const typeParam = urlParams.get('type');
        
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
        
        loadContracts();
    }
});
```

#### loadContracts 함수 수정
```javascript
async function loadContracts() {
    try {
        const response = await axios.get('/api/contracts');
        contracts = response.data;
        filteredContracts = contracts;
        filterContracts(); // URL 파라미터 필터를 적용하기 위해 filterContracts 호출
    } catch (error) {
        console.error('Error loading contracts:', error);
        // 에러 처리...
    }
}
```

## 🎨 CSS 스타일

### Tailwind CSS 클래스
```css
/* 기존 카드 스타일 */
.bg-white p-6 rounded-xl shadow-md

/* 추가된 인터랙티브 스타일 */
cursor-pointer           /* 마우스 포인터 커서 */
hover:shadow-lg          /* 호버 시 큰 그림자 */
hover:scale-105          /* 호버 시 5% 확대 */
transition-all           /* 모든 속성 애니메이션 */
```

### 시각적 효과
- **일반 상태**: 흰색 배경 + 중간 그림자
- **호버 상태**: 큰 그림자 + 5% 확대 + 부드러운 전환

## 📊 사용자 플로우

### 1. 개인계약 클릭
```
대시보드 (/)
  ↓ 클릭: 개인계약 카드
계약서 관리 (/static/contracts.html?type=personal)
  ↓ 자동 필터 적용
개인계약만 표시
```

### 2. 업체계약 클릭
```
대시보드 (/)
  ↓ 클릭: 업체계약 카드
계약서 관리 (/static/contracts.html?type=business)
  ↓ 자동 필터 적용
업체계약만 표시
```

### 3. 임시계약 클릭
```
대시보드 (/)
  ↓ 클릭: 임시계약 카드
계약서 관리 (/static/contracts.html?type=temp)
  ↓ 자동 필터 적용
임시계약(temp_rent)만 표시
```

### 4. 차용증 클릭
```
대시보드 (/)
  ↓ 클릭: 차용증 카드
차용증 관리 (/static/loans.html)
  ↓ 페이지 이동
전체 차용증 목록 표시
```

## 🧪 테스트

### 1. 대시보드 테스트
```bash
# 대시보드 접속
https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/

# 확인 사항
1. 4개 계약 카드에 마우스 오버 시 커서가 포인터로 변경
2. 호버 시 카드가 살짝 확대되고 그림자 강화
3. 클릭 시 해당 계약 목록 페이지로 이동
```

### 2. 필터링 테스트
```bash
# 개인계약 카드 클릭
→ /static/contracts.html?type=personal 이동
→ 계약 유형 필터가 "개인계약"으로 자동 설정
→ 개인계약만 표시

# 업체계약 카드 클릭
→ /static/contracts.html?type=business 이동
→ 계약 유형 필터가 "업체계약"으로 자동 설정
→ 업체계약만 표시

# 임시계약 카드 클릭
→ /static/contracts.html?type=temp 이동
→ 계약 유형 필터가 "임시렌트"로 자동 설정
→ 임시계약만 표시

# 차용증 카드 클릭
→ /static/loans.html 이동
→ 전체 차용증 목록 표시
```

### 3. HTML 검증
```bash
# cursor-pointer 클래스 확인 (4개)
curl -s http://localhost:3000 | grep -o "cursor-pointer" | wc -l
# 출력: 4

# filterByContractType 함수 확인 (5개: 함수 정의 1 + 카드 onclick 4)
curl -s http://localhost:3000 | grep -o "filterByContractType" | wc -l
# 출력: 5
```

## 📈 비즈니스 가치

### 1. 사용자 경험 향상
- **원클릭 필터링**: 대시보드에서 바로 특정 계약 유형으로 접근
- **직관적 네비게이션**: 통계 확인 → 상세 내역 조회를 한 번에
- **시간 절약**: 계약서 페이지에서 수동 필터 선택 불필요

### 2. 데이터 접근성
- **즉각적인 드릴다운**: 요약 통계에서 상세 데이터로 바로 이동
- **컨텍스트 유지**: URL 파라미터로 필터 상태 유지
- **북마크 가능**: 필터링된 상태의 URL을 북마크로 저장 가능

### 3. 운영 효율성
- **빠른 의사결정**: 특정 계약 유형의 상세 정보 즉시 확인
- **워크플로우 개선**: 대시보드 → 목록 → 상세의 자연스러운 흐름
- **멀티태스킹**: 여러 계약 유형을 탭으로 동시에 열어 비교 가능

## 🔧 기술 상세

### URL 파라미터 매핑
```
대시보드 파라미터 → contracts.html 필터 값
─────────────────────────────────────────
personal           → personal
business           → business
temp               → temp_rent
loan               → (loans.html로 리다이렉트)
```

### 브라우저 지원
- **URLSearchParams**: 모든 모던 브라우저 지원
- **CSS Transform (scale)**: 모든 모던 브라우저 지원
- **CSS Transitions**: 모든 모던 브라우저 지원

## 📝 변경 파일
1. `/home/user/webapp/src/index.tsx`
   - 대시보드 HTML: 카드에 클릭 이벤트 및 스타일 추가
   - JavaScript: filterByContractType 함수 추가
2. `/home/user/webapp/public/static/contracts.html`
   - DOMContentLoaded: URL 파라미터 읽기 로직 추가
   - loadContracts: filterContracts 호출로 변경

## ✅ 완료 상태
- [x] 대시보드 계약 카드에 클릭 이벤트 추가
- [x] filterByContractType 함수 구현
- [x] contracts.html URL 파라미터 처리 로직 추가
- [x] 카드 호버 효과 (cursor-pointer, shadow-lg, scale-105)
- [x] 임시계약 → temp_rent 매핑
- [x] 차용증 → loans.html 리다이렉트

## 🎯 향후 개선 사항
1. **애니메이션 강화**: 페이지 전환 시 부드러운 fade 효과
2. **브레드크럼**: 대시보드 → 계약서 목록 경로 표시
3. **뒤로가기 버튼**: 계약서 목록에서 대시보드로 쉽게 복귀
4. **필터 상태 표시**: 현재 적용된 필터를 배지로 표시
5. **검색 통합**: URL 파라미터로 검색어도 전달

---
**업데이트 완료**: 2026-02-02  
**테스트 URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/  
**테스트 방법**: 대시보드 접속 → 계약 카드 클릭 → 필터링된 목록 확인
