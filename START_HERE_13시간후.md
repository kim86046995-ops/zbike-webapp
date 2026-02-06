# 🎯 13시간 후 접속 시 바로 확인하세요

## 📦 백업 다운로드
**현재 상태 백업 파일**: https://www.genspark.ai/api/files/s/WpZpY5nv
- 파일명: `webapp_loan_pdf_fix_2026-02-01.tar.gz`
- 크기: 3.96 MB
- 설명: 차용증 PDF 다운로드 백지 문제 해결 완료

---

## ⚡ 빠른 테스트 (3분)

### 1. 브라우저 준비
```
모든 Chrome 탭 닫기
↓
새 시크릿 창 (Ctrl+Shift+N)
↓
아래 URL 접속
```

### 2. 테스트 URL
```
https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans
```

### 3. 테스트 실행
1. **F12** 눌러서 Console 열기
2. **"김상춘"** 차용증 찾기 (LOAN-20260201-0002)
3. **"상세보기"** 클릭
4. **"PDF 다운로드"** 클릭
5. **콘솔 확인**

---

## ✅ 성공 판단 기준

### 콘솔 로그에서 확인:
```
🎯 [차용증] downloadLoanPDF 호출됨
🚀 [차용증] PDF 생성기 시작
📊 [차용증] 데이터: LOAN-20260201-0002
✅ [차용증] Blob 생성 완료: 150000 bytes ← 100KB 이상!
✅ [차용증] PDF 다운로드 완료
```

### PDF 파일 확인:
- **파일 크기**: 100KB ~ 500KB (정상)
- **내용 포함**: 약관, 서명, 신분증 모두 있어야 함

---

## ❌ 실패 시 조치

### Case 1: 여전히 백지 (Blob 크기 30KB 이하)
```bash
cd /home/user/webapp
./quick-test.sh  # 데이터 확인
```

### Case 2: 함수가 실행되지 않음
```
1. Ctrl+Shift+R (강력 새로고침)
2. 시크릿 모드 재시도
3. 브라우저 캐시 완전 삭제
```

### Case 3: contracts.html의 함수가 실행됨
```
콘솔에 "✅ PDF 저장 완료 (File System Access API)" 표시
→ 브라우저 캐시 문제
→ /static/contracts 페이지 열지 마세요
```

---

## 🆘 긴급 대안

### 방법 1: 인쇄로 PDF 저장
```
1. 상세보기 열기
2. Ctrl+P
3. 대상: "PDF로 저장"
4. 저장
```
**참고**: 4번 반복 문제는 해결됨

### 방법 2: 브라우저 콘솔에서 직접 실행
```javascript
// 상세보기 열고 F12 → Console에 붙여넣기
(async () => {
    if (!currentLoan) {
        alert('상세보기를 먼저 열어주세요');
        return;
    }
    await LoanPDFGenerator.generate(currentLoan);
})();
```

---

## 🔍 서버 상태 확인 (필요 시)

```bash
cd /home/user/webapp
pm2 list  # 서버 실행 여부
./quick-test.sh  # 빠른 검증
```

---

## 📊 주요 변경 사항

### 1. 독립 PDF 생성기
- `LoanPDFGenerator` 객체로 완전 분리
- contracts.html과 이름 충돌 해결

### 2. 로그 구분
- `[차용증]` 접두사로 명확한 추적
- 어떤 함수가 실행되는지 즉시 확인 가능

### 3. 인쇄 수정
- `pdfContainer` 완전 숨김 처리
- 4번 반복 문제 해결

### 4. 함수 이름 변경
- `downloadPDF` → `downloadLoanPDF`
- `quickDownloadPDF` → `quickDownloadLoanPDF`

---

## 📁 추가 문서

1. **상세 가이드**: `/home/user/webapp/TROUBLESHOOTING.md`
2. **간단 가이드**: `/home/user/webapp/13시간후_테스트_가이드.md`
3. **빠른 테스트**: `./quick-test.sh`
4. **검증 스크립트**: `./verify-loan-system.sh`

---

## 🎯 예상 결과

- ✅ PDF 다운로드: **정상 작동** (100KB 이상)
- ✅ 인쇄 기능: **1번만 출력** (4번 반복 해결)
- ✅ 로그 구분: **[차용증] 접두사** 명확히 표시

---

**작성일**: 2026-02-01  
**백업 URL**: https://www.genspark.ai/api/files/s/WpZpY5nv  
**서버 URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai  

**문제 발생 시**: `/home/user/webapp/TROUBLESHOOTING.md` 참고
