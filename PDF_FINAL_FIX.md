# 차용증 PDF 레이아웃 최종 수정

## 🎯 근본 원인
1. **pdfContainer 위치**: `position: fixed; display: none` → html2pdf가 제대로 캡처 못함
2. **이중 패딩**: pdfContainer (20px) + 내부 콘텐츠 (0 20px) = 불필요한 패딩
3. **jsPDF 직접 구현**: 여백 계산 오류

## ✅ 최종 해결책

### 1. pdfContainer 위치 수정
```html
<!-- 수정 전 -->
<div id="pdfContainer" style="position: fixed; left: 0; top: 0; ... display: none;">

<!-- 수정 후 (contracts.html과 동일) -->
<div id="pdfContainer" style="position: absolute; left: -9999px; top: 0; width: 794px; background: white; padding: 20px;">
```

### 2. 내부 패딩 제거
```javascript
// 수정 전
const html = `
  <div class="space-y-6" style="padding: 0 20px; ...">

// 수정 후
const html = `
  <div class="space-y-6" style="font-size: 1.1rem; color: #1a1a1a; font-weight: 500;">
```

### 3. PDF 생성 로직 통합
- jsPDF + html2canvas 직접 구현 → **html2pdf 라이브러리 사용**
- contracts.html과 완전히 동일한 로직

## 🧪 테스트
1. **브라우저 캐시 완전 삭제** (Ctrl+Shift+Delete → 전체 기간)
2. **시크릿 모드** (Ctrl+Shift+N)
3. URL: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans
4. 김상춘 (LOAN-20260201-0002) 선택
5. 상세보기 → PDF 다운로드

## 📊 기대 결과
- ✅ 좌우 여백 균등 (각 10mm)
- ✅ 중앙 정렬
- ✅ contracts.html과 동일한 레이아웃
- ✅ 파일 크기: 300KB~500KB

## 🔍 검증 완료
```bash
✅ pdfContainer: 완전히 동일
✅ html2pdf margin: [8, 10, 8, 10]
✅ html2canvas scale: 2
✅ 캡처 대상: element (pdfContent)
✅ 내부 패딩: 제거됨
```

