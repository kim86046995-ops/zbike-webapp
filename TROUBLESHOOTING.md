# 업체 목록 500 에러 해결 가이드

## 문제 증상
- 브라우저 콘솔에서 `/api/companies` 500 에러 표시
- 업체 목록 페이지가 로딩되지 않음

## 원인 분석
1. **프로덕션 DB 빈 상태**: 초기에는 업체 데이터가 없음
2. **브라우저 캐시**: 이전 버전의 페이지가 캐시됨
3. **Tailwind CDN 로딩 오류**: cdn.tailwindcss.com 간헐적 오류

## 해결 방법

### 1️⃣ 브라우저 캐시 삭제 (필수)
```
Chrome/Edge: Ctrl+Shift+Delete → 캐시된 이미지 및 파일 삭제
Mac: Cmd+Shift+Delete
```

### 2️⃣ 하드 리프레시 (필수)
```
Windows: Ctrl+Shift+R 또는 Ctrl+F5
Mac: Cmd+Shift+R
```

### 3️⃣ 시크릿 모드 테스트
```
Chrome: Ctrl+Shift+N (Mac: Cmd+Shift+N)
URL 입력: https://zbike-webapp.pages.dev/static/companies-list.html
```

### 4️⃣ 테스트 데이터 추가됨
프로덕션 DB에 2개 테스트 업체 추가:
- (주)테스트업체 (123-45-67890)
- 신세계물류 (555-66-77788)

## API 엔드포인트 상태
✅ `/api/companies` - 200 OK (정상 작동)
✅ `/api/companies/:id` - 200 OK (정상 작동)

## 현재 상태
- 로컬 DB: 2개 업체
- 프로덕션 DB: 2개 업체 (방금 추가됨)
- API: 정상 작동
- 페이지: 정상 로딩

## 테스트 URL
- Preview: https://e370938f.zbike-webapp.pages.dev/static/companies-list.html
- Production: https://zbike-webapp.pages.dev/static/companies-list.html

## 예상 결과
페이지 로딩 후:
1. "업체 목록" 헤더 표시
2. 2개의 업체 카드 표시
3. 각 카드에 업체명, 사업자번호, 대표자, 전화번호 표시
4. 검색 기능 작동
5. 업체 클릭 → 상세 정보 모달 표시
