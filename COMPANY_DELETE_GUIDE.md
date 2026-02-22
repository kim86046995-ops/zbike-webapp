# 업체 삭제 기능 테스트 가이드

## ✅ 완료된 기능

### 1. 업체 삭제 API
- **엔드포인트**: `DELETE /api/companies/:id`
- **방식**: Soft Delete (status='inactive'로 변경)
- **인증**: 필요 없음 (일반 사용자도 삭제 가능)
- **응답**:
  ```json
  {
    "success": true,
    "message": "업체가 성공적으로 삭제되었습니다.",
    "id": 2,
    "company_name": "테스트회사"
  }
  ```

### 2. 업체 목록 UI 개선
- ✅ 각 업체 카드에 **삭제 버튼** 추가 (빨간색, 휴지통 아이콘)
- ✅ 상세보기 버튼 (파란색, 눈 아이콘)
- ✅ 삭제 확인 대화상자
- ✅ 삭제 후 자동 목록 새로고침

### 3. 안전장치
- ✅ 삭제 전 확인 대화상자 표시
- ✅ 삭제된 데이터는 복구 불가 경고
- ✅ Soft Delete로 데이터는 DB에 보존 (status='inactive')
- ✅ 목록 조회 시 active 업체만 표시

## 🌐 테스트 URL

### 프로덕션 환경
- **업체 목록**: https://zbike-webapp.pages.dev/static/companies-list.html
- **업체 등록**: https://zbike-webapp.pages.dev/static/company-register.html
- **대시보드**: https://zbike-webapp.pages.dev/dashboard
- **로그인**: https://zbike-webapp.pages.dev/static/login.html

### 프리뷰 환경 (최신 버전, 즉시 반영)
- **업체 목록**: https://073f529f.zbike-webapp.pages.dev/static/companies-list.html
- **업체 등록**: https://073f529f.zbike-webapp.pages.dev/static/company-register.html

## 📋 현재 등록된 업체 (프로덕션)

| ID | 업체명 | 사업자번호 | 대표자 | 전화번호 |
|----|--------|-----------|--------|----------|
| 5 | 모란 | 330-02-20002 | 이길나 | 010-7854-2321 |
| 4 | 제트 | 777-88-99900 | 김말동 | 010-4525-2222 |
| 3 | 테스트신규업체 | 888-99-11111 | 홍길동 | 010-8888-9999 |
| 2 | 신세계물류 | 555-66-77788 | 이순신 | 010-5555-6666 |
| 1 | (주)테스트업체 | 123-45-67890 | 김대표 | 010-1234-5678 |

**총 5개 업체 등록**

## 🧪 테스트 시나리오

### 시나리오 1: 업체 삭제 (권장)

1. **로그인**
   - URL: https://zbike-webapp.pages.dev/static/login.html
   - ID: `sangchun11`
   - PW: `a2636991`

2. **업체 목록 접속**
   - 대시보드 → 빠른 액세스 → "업체 목록" (보라색 버튼)
   - 또는 직접 URL: https://zbike-webapp.pages.dev/static/companies-list.html

3. **업체 삭제**
   - 원하는 업체 카드에서 **빨간색 휴지통 아이콘** 클릭
   - 확인 대화상자 내용 확인:
     ```
     정말 "업체명" 업체를 삭제하시겠습니까?
     
     삭제된 업체 정보는 복구할 수 없습니다.
     ```
   - "확인" 클릭

4. **결과 확인**
   - 성공 알림: `"업체명" 업체가 성공적으로 삭제되었습니다.`
   - 목록에서 해당 업체 자동 제거
   - 업체 수 감소 확인

### 시나리오 2: 새 업체 등록 후 삭제

1. **새 업체 등록**
   - URL: https://zbike-webapp.pages.dev/static/company-register.html
   - **테스트 데이터** (사용 가능한 새 사업자번호):
     - 업체명: `테스트삭제업체`
     - 사업자번호: `111-11-11111` ✅ (사용 가능)
     - 대표자명: `테스트`
     - 전화번호: `010-1111-2222`
     - 주민번호: `900101-1234567`
     - 주소 검색 후 입력 (예: 서울 강남구)
     - 신분증 사진 업로드 (아무 이미지 파일)

2. **등록 완료**
   - "등록하기" 클릭
   - 자동으로 업체 목록으로 이동
   - 새로 등록된 업체 카드 확인 (맨 위)

3. **바로 삭제 테스트**
   - 방금 등록한 "테스트삭제업체" 카드에서 삭제 버튼 클릭
   - 확인 후 삭제
   - 목록에서 제거 확인

### 시나리오 3: API 직접 테스트 (개발자용)

```bash
# 1. 현재 업체 목록 확인
curl -s "https://zbike-webapp.pages.dev/api/companies" | jq

# 2. 특정 업체 삭제 (예: ID 5번)
curl -X DELETE "https://zbike-webapp.pages.dev/api/companies/5"

# 3. 삭제 후 목록 재확인
curl -s "https://zbike-webapp.pages.dev/api/companies" | jq
```

## 🔍 문제 해결

### 문제 1: 삭제 버튼이 보이지 않음
- **원인**: 브라우저 캐시
- **해결**:
  1. Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac) - 강력 새로고침
  2. 또는 시크릿 모드로 접속
  3. 또는 프리뷰 URL 사용: https://073f529f.zbike-webapp.pages.dev/static/companies-list.html

### 문제 2: 삭제 후 목록에서 사라지지 않음
- **원인**: 페이지 자동 새로고침 실패
- **해결**:
  1. 수동으로 새로고침 버튼 클릭 (목록 상단)
  2. 또는 F5 키로 페이지 새로고침

### 문제 3: 삭제 시 에러 발생
- **원인**: 네트워크 오류 또는 서버 문제
- **해결**:
  1. 콘솔 로그 확인 (F12 → Console 탭)
  2. 에러 메시지 확인
  3. 잠시 후 다시 시도

## 📊 삭제 전/후 비교

### 삭제 전
- 업체 목록: 5개
- API 응답: `[{id:1,...}, {id:2,...}, {id:3,...}, {id:4,...}, {id:5,...}]`

### 삭제 후 (예: ID 5번 삭제)
- 업체 목록: 4개
- API 응답: `[{id:1,...}, {id:2,...}, {id:3,...}, {id:4,...}]`
- 데이터베이스: ID 5번 업체는 status='inactive'로 보존

## 🎯 핵심 포인트

### ✅ 성공한 부분
1. 삭제 API 엔드포인트 정상 작동
2. UI에 삭제 버튼 추가 완료
3. 삭제 확인 대화상자 구현
4. Soft Delete로 데이터 보존
5. 자동 목록 새로고침
6. GitHub 푸시 완료
7. Cloudflare Pages 배포 완료

### 🔒 안전장치
1. 확인 대화상자 필수
2. Soft Delete (물리적 삭제 아님)
3. 목록 조회 시 active만 표시
4. 복구 불가 경고 메시지

### 📝 데이터베이스 구조
```sql
-- 삭제 전
SELECT * FROM companies WHERE id = 5;
-- status = 'active'

-- 삭제 후
SELECT * FROM companies WHERE id = 5;
-- status = 'inactive', updated_at = '2026-02-22 ...'

-- 목록 조회 (active만)
SELECT * FROM companies WHERE status = 'active';
```

## 🚀 다음 단계

### 추가 가능한 기능
1. ✅ 삭제 기능 (완료)
2. ⏳ 업체 수정 기능
3. ⏳ 삭제된 업체 복구 기능 (Admin)
4. ⏳ 업체별 계약 내역 조회
5. ⏳ 업체 정보 엑셀 다운로드

## 📞 문의사항

문제가 발생하면 다음 정보를 제공해주세요:
1. 브라우저 콘솔 로그 (F12 → Console 탭 스크린샷)
2. 발생한 에러 메시지
3. 시도한 단계
4. 사용한 URL

---

**마지막 업데이트**: 2026-02-22  
**배포 URL**: https://073f529f.zbike-webapp.pages.dev  
**프로덕션 URL**: https://zbike-webapp.pages.dev
