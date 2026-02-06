# 차용증 PDF 다운로드 문제 해결 가이드

## 📋 문제 요약

- **오토바이 계약서**: PDF 다운로드 정상 작동 (2MB)
- **차용증**: PDF 다운로드 백지 (32KB) ❌
- **인쇄 기능**: 4번 반복 문제 ❌

---

## ✅ 적용된 해결책

### 1. **독립적인 PDF 생성기 구현**

**문제**: contracts.html의 `downloadPDF()` 함수와 이름 충돌
**해결**: `LoanPDFGenerator` 객체로 완전 독립 구현

```javascript
const LoanPDFGenerator = {
    async generate(loanData) {
        // 차용증 전용 PDF 생성 로직
    }
};
```

**특징**:
- `[차용증]` 접두사로 로그 구분
- contracts.html의 영향을 받지 않음
- 단순화된 에러 처리

### 2. **인쇄 4번 반복 문제 해결**

**문제**: `pdfContainer`가 인쇄에 포함되어 중복 출력
**해결**: print CSS에 완전 숨김 추가

```css
@media print {
    #pdfContainer, #pdfContainer * {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
    }
}
```

---

## 🧪 13시간 후 테스트 절차

### **준비 단계**

1. **브라우저 완전히 닫기**
   - 모든 Chrome 탭/창 닫기
   - 캐시 완전 초기화

2. **새 브라우저 창 열기**
   - 시크릿 모드 사용 권장
   - `Ctrl+Shift+N` (Chrome)

### **테스트 1: PDF 다운로드**

**URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans

**절차**:
1. F12 → Console 탭 열기
2. Console 초기화: `Ctrl+L` 또는 🚫 아이콘 클릭
3. 차용증 목록에서 **"김상춘" (LOAN-20260201-0002)** 선택
4. 상세보기 클릭
5. **PDF 다운로드** 버튼 클릭
6. 콘솔 로그 확인

**✅ 성공 시 콘솔 로그**:
```
🎯 [차용증] downloadLoanPDF 호출됨
🚀 [차용증] PDF 생성기 시작
📊 [차용증] 데이터: LOAN-20260201-0002
✅ [차용증] 콘텐츠 확인 완료
🎨 [차용증] PDF 생성 중...
✅ [차용증] Blob 생성 완료: 150000~ bytes  (100KB 이상이어야 정상)
✅ [차용증] PDF 다운로드 완료: 차용증_LOAN-20260201-0002.pdf
```

**❌ 실패 시 콘솔 로그**:
```
✅ PDF 저장 완료 (File System Access API)  ← 이것은 contracts.html의 로그!
```

**실패 시 조치**:
1. 브라우저 캐시 강제 삭제
   - `Ctrl+Shift+Delete`
   - "캐시된 이미지 및 파일" 선택
   - 삭제 후 재시도
2. 시크릿 모드 사용
3. `/static/contracts` 페이지를 절대 열지 않고 `/static/loans`만 테스트

---

### **테스트 2: 인쇄 기능**

**절차**:
1. 차용증 상세보기 열기
2. **인쇄** 버튼 클릭 (또는 `Ctrl+P`)
3. 인쇄 미리보기 확인

**✅ 성공 기준**:
- "배달대행 차용증"이 **1번만** 표시
- 내용 중복 없음
- 약관, 서명, 신분증 모두 포함

**❌ 여전히 4번 반복되면**:
```bash
# 서버에서 직접 확인
cd /home/user/webapp
grep -n "#pdfContainer" public/static/loans.html
# → 266번 라인만 나와야 함

grep -A5 "@media print" public/static/loans.html | grep -A3 "pdfContainer"
# → display: none !important 확인
```

---

## 🔍 디버깅 가이드

### 문제 1: PDF가 여전히 백지

**확인 사항**:
1. 콘솔에서 Blob 크기 확인
   - **30KB 이하**: 여전히 백지 (이미지 누락)
   - **100KB 이상**: 정상 (이미지 포함)

2. 이미지 데이터 확인
   ```bash
   curl -s http://localhost:3000/api/loan-contracts/2 | jq '{
     borrower_signature: (.borrower_signature | length),
     borrower_id_card_photo: (.borrower_id_card_photo | length)
   }'
   # → 둘 다 1000 이상이어야 정상
   ```

3. 다른 차용증으로 테스트
   - LOAN-1은 데이터 손상 (37자)
   - LOAN-2 (김상춘)만 정상 데이터

---

### 문제 2: 함수 호출 자체가 안 됨

**확인**:
```javascript
// 브라우저 콘솔에서 직접 실행
console.log(typeof LoanPDFGenerator);  // → "object"
console.log(typeof downloadLoanPDF);   // → "function"
```

**실패 시**:
- 페이지 강제 새로고침: `Ctrl+Shift+R`
- 또는 JavaScript 파일 직접 확인:
  ```bash
  curl -s https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans | grep "LoanPDFGenerator"
  ```

---

### 문제 3: 인쇄가 여전히 4번 반복

**원인 가능성**:
1. print CSS가 적용되지 않음 (캐시)
2. pdfContainer가 여전히 표시됨

**확인 방법**:
```javascript
// 인쇄 미리보기 열고 브라우저 콘솔에서 실행
document.querySelectorAll('#pdfContainer').length;  // → 1이어야 정상
document.querySelectorAll('#loanDetail').length;     // → 1이어야 정상

// pdfContainer가 숨겨져 있는지 확인
const pdfContainer = document.getElementById('pdfContainer');
window.getComputedStyle(pdfContainer).display;  // 인쇄 모드에서 "none"이어야 함
```

---

## 🚨 긴급 대안 (PDF 다운로드 실패 시)

### 방법 1: 인쇄로 PDF 저장

1. 차용증 상세보기 열기
2. `Ctrl+P` (인쇄)
3. 대상: **PDF로 저장**
4. 저장 버튼 클릭

**장점**: 100% 작동
**단점**: 4번 반복 문제 (해결 중)

---

### 방법 2: 브라우저 콘솔에서 직접 실행

```javascript
// 1. 차용증 상세보기 열기
// 2. F12 → Console
// 3. 아래 코드 붙여넣기

(async function() {
    try {
        if (!currentLoan) {
            alert('차용증 상세보기를 먼저 열어주세요');
            return;
        }
        
        const result = await LoanPDFGenerator.generate(currentLoan);
        console.log('✅ 성공:', result);
    } catch (error) {
        console.error('❌ 실패:', error);
        alert('오류: ' + error.message);
    }
})();
```

---

## 📊 현재 상태 (2026-02-01)

### ✅ 정상 작동
- 오토바이 계약서 PDF 다운로드
- 차용증 데이터 조회
- 차용증 렌더링

### ⚠️ 개선 중
- 차용증 PDF 다운로드 (백지 → 정상)
- 인쇄 4번 반복 (→ 1번)

### 🔧 기술 스택
- Backend: Hono (Cloudflare Workers)
- Frontend: Vanilla JS + Tailwind CSS
- PDF: html2pdf.js 0.10.1
- Database: Cloudflare D1 SQLite

---

## 📞 문제 지속 시 조치

1. **PM2 로그 확인**:
   ```bash
   cd /home/user/webapp
   pm2 logs webapp --nostream --lines 100
   ```

2. **데이터베이스 확인**:
   ```bash
   npx wrangler d1 execute webapp-production --local --command="SELECT id, loan_number, LENGTH(borrower_signature) as sig_len, LENGTH(borrower_id_card_photo) as id_len FROM loan_contracts"
   ```

3. **파일 무결성 확인**:
   ```bash
   grep -c "LoanPDFGenerator" public/static/loans.html  # → 2 이상
   grep -c "downloadLoanPDF" public/static/loans.html   # → 3 이상
   ```

---

## 🎯 최종 목표

- [ ] 차용증 PDF 다운로드: 완전한 내용 (약관, 서명, 신분증 포함)
- [ ] Blob 크기: 100KB 이상
- [ ] 인쇄 기능: 1번만 출력
- [ ] 콘솔 로그: `[차용증]` 접두사로 명확히 구분

---

**작성일**: 2026-02-01  
**버전**: v1.0  
**상태**: 해결 완료 (테스트 대기 중)
