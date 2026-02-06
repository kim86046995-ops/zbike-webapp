# 보안 정책 문서

## 개요
고객 포털은 로그인 없이 제한된 기능만 사용할 수 있도록 보안을 강화했습니다.

## 공개 API (인증 불필요)

### 고객 포털용 공개 API
이 API들은 로그인 없이 접근 가능합니다:

1. **POST /api/customers**
   - 고객 정보 등록
   - 민감한 정보: 주민등록번호, 주소, 전화번호

2. **POST /api/contracts**
   - 계약서 작성 및 저장
   - 고객이 직접 계약서 작성 가능

3. **GET /api/contracts?resident_number=XXXXXX**
   - 본인 계약서 조회 (주민등록번호 필터링)
   - 본인 확인용으로만 사용

4. **GET /api/temp-rent-contracts?resident_number=XXXXXX**
   - 본인 임시렌트 계약 조회
   - 주민등록번호로 필터링

5. **GET /api/business-contracts?resident_number=XXXXXX**
   - 본인 업체 계약 조회
   - 대표자 주민등록번호로 필터링

6. **GET /api/public/motorcycles/search?plate_number=XXXX**
   - 번호판으로 오토바이 검색 (민감한 정보 제외)
   - 반환 정보: id, plate_number, vehicle_name, model_year만

### 계약 공유용 공개 API
7. **GET /api/contract-share/:token**
   - 토큰으로 계약서 조회
   - 공유 링크로 접근

8. **POST /api/contract-share/:token/sign**
   - 고객 서명 저장
   - 공유 링크로 계약서 서명

## 보호된 API (인증 필요)

### 오토바이 관리
- GET /api/motorcycles - 전체 목록 (고객 정보 포함)
- GET /api/motorcycles/:id - 상세 조회
- POST /api/motorcycles - 등록
- PUT /api/motorcycles/:id - 수정
- DELETE /api/motorcycles/:id - 삭제
- POST /api/motorcycles/:id/scrap - 폐기 처리
- GET /api/motorcycles/:id/contracts - 계약 이력 (민감한 고객 정보 포함)
- GET /api/motorcycles/:id/history - 사용 이력 (민감한 고객 정보 포함)
- GET /api/motorcycles/history/search - 이력 검색

### 고객 관리
- GET /api/customers - 전체 목록 (민감한 개인정보)
- GET /api/customers/:id - 상세 조회
- PUT /api/customers/:id - 수정
- DELETE /api/customers/:id - 삭제

### 계약 관리
- GET /api/contracts/:id - 상세 조회 (민감한 계약 정보)
- PUT /api/contracts/:id/complete - 완료 처리
- PUT /api/contracts/:id/insurance - 보험 정보 수정
- DELETE /api/contracts/:id - 삭제
- GET /api/contracts/:id/history - 계약 이력
- POST /api/contracts-admin-save - 관리자 계약 저장
- POST /api/temp-rent-contracts - 임시렌트 계약 생성

### 업체 계약 관리
- POST /api/business-contracts - 생성
- GET /api/business-contracts/:id - 상세 조회
- PUT /api/business-contracts/:id/complete - 완료 처리
- DELETE /api/business-contracts/:id - 삭제

### 차용증 관리
- GET /api/loan-contracts - 목록 조회
- GET /api/loan-contracts/:id - 상세 조회
- POST /api/loan-contracts - 생성
- POST /api/loan-contracts/:id/deduction - 차감 기록 추가
- GET /api/loan-contracts/:id/deductions - 차감 내역 조회

### 회사/업체 관리
- GET /api/companies - 업체 목록
- GET /api/companies/:id - 업체 상세
- POST /api/companies - 업체 등록
- PUT /api/companies/:id - 업체 수정
- DELETE /api/companies/:id - 업체 삭제 (슈퍼관리자)
- GET /api/company-settings - 회사 설정 조회
- PUT /api/company-settings - 회사 설정 수정

### 대시보드 및 통계
- GET /api/dashboard/stats - 대시보드 통계 (민감한 사업 정보)

### 계약 공유 관리
- POST /api/contract-share/create - 공유 링크 생성
- GET /api/contract-shares - 공유 목록 조회

### SMS 및 알림
- POST /api/send-sms - SMS 전송

### 관리자 관리
- GET /api/admin/users - 사용자 목록
- POST /api/admin/users/:id/status - 사용자 상태 변경
- GET /api/admins - 관리자 목록
- PUT /api/admins/:id/status - 관리자 상태 변경

### 데이터 가져오기
- POST /api/import/knox-login - Knox 로그인
- POST /api/import/knox-fetch - Knox 데이터 가져오기
- POST /api/import/knox-cookie - Knox 쿠키 설정
- POST /api/import/analyze - 데이터 분석
- POST /api/import/analyze-pdfs - PDF 분석
- POST /api/import/motorcycles - 오토바이 가져오기
- POST /api/import/contracts - 계약 가져오기

## 인증 방식

### 세션 기반 인증
- 로그인 시 세션 ID 발급
- localStorage에 저장
- X-Session-ID 헤더로 전송
- 401 응답 시 자동 로그아웃

### 인증 미들웨어
- `authMiddleware`: 일반 인증 확인
- `superAdminMiddleware`: 슈퍼관리자 권한 확인

## 고객 포털 접근 제어

### 허용되는 페이지
1. `/static/login.html` - 로그인 페이지
2. `/static/customer-portal.html` - 고객 포털 메인
3. `/static/customer-register.html` - 고객 정보 등록
4. `/static/customer-contract.html` - 계약서 작성
5. `/static/contract-search.html` - 본인 계약서 조회

### 차단되는 페이지 (로그인 필요)
- `/static/dashboard.html` - 관리자 대시보드
- `/static/motorcycles.html` - 오토바이 관리
- `/static/contracts.html` - 계약 관리
- `/static/customers.html` - 고객 관리
- `/static/companies.html` - 업체 관리
- `/static/loan-contracts.html` - 차용증 관리
- 기타 모든 관리자 페이지

## 보안 고려사항

### 주민등록번호 보호
- 주민등록번호는 본인 확인용으로만 사용
- 전체 목록 조회 시 주민등록번호 노출 금지
- 주민등록번호로 필터링 시 정확히 일치하는 데이터만 반환

### 고객 정보 보호
- 전체 고객 목록 조회는 인증 필요
- 고객 상세 정보는 인증 필요
- 고객 수정/삭제는 인증 필요

### 계약 정보 보호
- 전체 계약 목록은 인증 없이도 조회 가능하지만 주민등록번호 필터링 필수
- 계약 상세 조회는 인증 필요
- 계약 수정/삭제는 인증 필요

### 오토바이 정보 보호
- 전체 목록 조회 시 고객 정보 포함 (인증 필요)
- 공개 검색 API는 민감한 정보 제외
- 사용 이력 조회는 인증 필요

## 보안 권장사항

### 프론트엔드
1. 민감한 정보는 로컬 스토리지에 저장 금지
2. HTTPS 사용 필수
3. XSS 방지: 사용자 입력 검증
4. CSRF 방지: 토큰 사용

### 백엔드
1. SQL Injection 방지: Prepared Statements 사용
2. Rate Limiting 구현 권장
3. 입력 검증 강화
4. 에러 메시지에서 민감한 정보 노출 금지

### 데이터베이스
1. 주민등록번호 암호화 권장
2. 정기적인 백업
3. 접근 로그 기록
4. 불필요한 데이터 정기 삭제

## 업데이트 이력

- 2026-02-05: 초기 보안 정책 수립
  - 공개 API 최소화
  - 민감한 API에 인증 추가
  - 고객 포털 접근 제어 강화
