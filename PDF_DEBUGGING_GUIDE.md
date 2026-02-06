# 차용증 PDF 레이아웃 문제 - 디버깅 가이드

**작성일**: 2026-02-02  
**문제**: 차용증 PDF 내용이 여전히 한쪽으로 치우침  
**상태**: 🔍 디버깅 중

---

## 🔍 문제 상황

### 현재 증상
- ✅ PDF는 생성됨 (345 KB, 4페이지)
- ❌ 내용이 왼쪽으로 몰려있음
- ❌ 오른쪽에 큰 공백

### 시도한 해결책
1. ✅ `padding: 20px` 추가 → 변화 없음
2. ✅ `max-width`, `margin` 제거 → 변화 없음
3. ✅ `box-sizing: border-box` 추가 → 변화 없음
4. ✅ contracts.html과 완전히 동일하게 설정 → 여전히 문제

---

## 📊 현재 설정 (contracts.html과 동일)

### pdfContainer
```html
<div id="pdfContainer" style="position: absolute; left: -9999px; top: 0; width: 794px; background: white; padding: 20px;">
    <div id="pdfContent" class="contract-print"></div>
</div>
```

### PDF 생성 옵션
```javascript
const opt = {
    margin: [8, 10, 8, 10],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: true,
        scrollY: 0,
        scrollX: 0
    },
    jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
    },
    pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        avoid: ['.signature-section', '.terms-agreement', '.contract-terms']
    }
};
```

### HTML 루트 스타일
```javascript
<div class="space-y-6" style="box-sizing: border-box; font-size: 1.1rem; color: #1a1a1a; font-weight: 500;">
```

---

## 🧪 디버깅 로그 추가

### 추가된 로그
```javascript
console.log('📐 [차용증] element 크기:', {
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight
});
console.log('📐 [차용증] pdfContainer 크기:', {
    offsetWidth: element.parentElement.offsetWidth,
    scrollWidth: element.parentElement.scrollWidth,
    clientWidth: element.parentElement.clientWidth
});
```

### 기대하는 값
- **pdfContainer width**: 794px
- **pdfContent width**: 754px (794px - 40px padding)
- **scrollWidth**: 실제 콘텐츠 너비

---

## 🔍 의심되는 원인

### 1. **grid-cols-3 레이아웃**
- 차용증과 오토바이 계약서 모두 `grid-cols-3` 사용
- 하지만 오토바이는 정상, 차용증은 비정상
- **가능성**: 낮음

### 2. **Tailwind CSS 충돌**
- Tailwind의 기본 스타일이 개입?
- `box-sizing` 설정 차이?
- **가능성**: 중간

### 3. **html2canvas 렌더링 버그**
- off-screen 요소 캡처 시 width 잘못 계산?
- padding 계산 오류?
- **가능성**: 높음

### 4. **콘텐츠 자체의 구조 문제**
- 특정 요소가 너무 넓게 설정?
- 이미지 크기 문제?
- **가능성**: 중간

---

## 🧪 테스트 방법

### 테스트 URL
```
https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans
```

### 테스트 절차
1. **브라우저 개발자 도구 열기** (F12)
2. **Console 탭 열기**
3. **"김상춘" (LOAN-20260201-0002) 선택**
4. **상세보기 → PDF 다운로드**
5. **콘솔 로그 확인**

### 확인할 로그
```
📐 [차용증] element 크기: {
    offsetWidth: ???,      ← 이 값 확인!
    scrollWidth: ???,      ← 이 값 확인!
    clientWidth: ???       ← 이 값 확인!
}
📐 [차용증] pdfContainer 크기: {
    offsetWidth: ???,      ← 794여야 함
    scrollWidth: ???,      ← 794여야 함
    clientWidth: ???       ← 754여야 함 (794 - 40 padding)
}
```

### 비정상 상황 판단
- `offsetWidth` > 794 → 콘텐츠가 너무 넓음
- `scrollWidth` > 794 → 내부 콘텐츠가 넘침
- `clientWidth` < 700 → padding 문제

---

## 🔧 다음 단계

### 로그 결과에 따른 대응

#### Case 1: offsetWidth가 794가 아님
→ pdfContainer의 width 설정이 무시됨
→ CSS 강제 적용 필요

#### Case 2: scrollWidth > 794
→ 내부 콘텐츠가 너무 넓음
→ 특정 요소의 width 제한 필요

#### Case 3: 모든 값이 정상
→ html2canvas의 버그
→ 다른 PDF 라이브러리 시도 (jsPDF + html2canvas 직접 사용)

---

## 📝 비교 테스트

### 오토바이 계약서도 테스트
1. https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/contracts
2. 아무 계약서나 선택
3. PDF 다운로드
4. **같은 로그 추가 후 비교**

---

## 💡 임시 해결책 (최후의 수단)

### 1. width를 명시적으로 줄이기
```javascript
html2canvas: { 
    scale: 2,
    windowWidth: 700,  // 794 대신 700
    ...
}
```

### 2. CSS transform 사용
```css
#pdfContent {
    transform: scale(0.9);
    transform-origin: top left;
}
```

### 3. 다른 라이브러리 사용
- puppeteer (서버 사이드)
- jsPDF + html2canvas (직접 구현)
- pdfmake (템플릿 기반)

---

## 📊 현재 상태

- ✅ 모든 설정 contracts.html과 동일
- ✅ 디버깅 로그 추가 완료
- ⏳ 사용자 테스트 대기 중
- ❓ 근본 원인 미파악

---

**다음 액션**: 
1. 위 테스트 절차대로 실행
2. 콘솔 로그 스크린샷 제공
3. 로그 분석 후 정확한 원인 파악

---

**중요**: contracts.html의 동일한 로그도 추가해서 비교하면 더 정확한 진단 가능
