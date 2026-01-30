# 오토바이 리스/렌트 전자계약 시스템

## 프로젝트 개요
- **이름**: 오토바이 리스/렌트 전자계약 시스템
- **목적**: 오토바이 리스/렌트 업체를 위한 전자 계약서 작성 및 관리 시스템
- **주요 기능**: 오토바이 관리, 전자 계약서 작성, 전자서명, 계약 내역 조회

## 🌐 URLs
- **개발 서버**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai
- **GitHub**: (배포 후 추가 예정)

## ✨ 주요 기능

### 1. 오토바이 관리
- ✅ 오토바이 정보 등록
  - 번호판, 차량이름, 차대번호
  - 키로수, 연식
  - 보험사, 보험기간 (시작일~종료일)
  - 운전범위, 명의자
  - 보험료, 차량금액, **일대여료**
  - 사용 현황 메모 (usage_notes)
  - 상태 (사용가능/렌트중/정비중)
- ✅ 오토바이 목록 조회 및 필터링
- ✅ 오토바이 정보 수정/삭제
- ✅ 실시간 상태 관리
- ✅ **보험 기간 진행률 시각화** (프로그레스 바)
  - 날짜가 지날수록 자동으로 줄어드는 프로그레스 바
  - 만료 임박 시 경고 표시 (30일 이내)
  - 만료된 보험 강조 표시
  - 남은 일수 실시간 계산
- ✅ **번호판 클릭으로 계약 이력 조회**
  - 해당 오토바이의 모든 계약 이력 표시
  - 계약 상태별 구분 (진행중/완료/취소)
  - 고객 정보 및 계약 상세 내용 표시

### 2. 계약서 작성
- ✅ 계약 타입 선택 (리스/렌트)
- ✅ 사용 가능한 오토바이 선택
- ✅ 고객 정보 입력
  - 이름, 주민번호
  - 전화번호, 주소
  - 면허종류 (2종 소형, 2종 보통, 1종 보통, 1종 대형)
- ✅ 계약 상세 정보
  - 계약 기간 (시작일~종료일)
  - **일대여료** (daily_rental_fee)
  - 보증금
  - 특약사항
- ✅ **신분증 촬영 기능**
  - 웹캠으로 신분증 촬영
  - 파일 업로드 지원
  - 미리보기 및 재촬영
  - Base64 형식으로 저장
- ✅ 전자서명 기능 (캔버스 기반)
  - 마우스/터치 서명 지원
  - 서명 이미지 저장 (base64)
- ✅ 자동 계약번호 생성 (YYYYMMDD-XXXX 형식)

### 3. 계약서 관리
- ✅ 계약서 목록 조회
- ✅ 필터링 (계약 타입, 상태)
- ✅ 검색 (계약번호, 고객명, 번호판)
- ✅ 계약서 상세 보기
  - 계약 정보
  - 고객 정보
  - 오토바이 상세 정보
  - 계약 상세 내용
  - 서명 이미지
  - 신분증 사진
- ✅ 계약 상태 관리 (진행중/완료/취소)

### 4. 차용증 관리 🆕
- ✅ 차용증 작성
  - 차용인 정보 (이름, 주민번호, 전화번호, 주소)
  - 대여인 정보 (이름, 주민번호, 전화번호, 주소)
  - 차용 금액 및 이자율
  - 차용일 및 상환일
  - 상환 방법 (일시불/분할)
  - 담보 정보
  - 특약사항
- ✅ **차용증 약관 (전문적인 법적 조항)**
  - 제1조: 차용금액 및 기간
  - 제2조: 상환방법
  - 제3조: 담보 및 보증
  - 제4조: 기한의 이익 상실
  - 제5조: 연체이자 및 지연배상금 (연 15%)
  - 제6조: 비용 부담
  - 제7조: 계약의 해석 및 합의
  - 제8조: 관할 법원
- ✅ 이중 전자서명 (차용인 + 대여인)
- ✅ **신분증 촬영 기능**
- ✅ 차용증 목록 및 상세 보기
- ✅ 상태 관리 (진행중/완료/연체/취소)

## 📊 데이터 아키텍처

### 데이터베이스: Cloudflare D1 (SQLite)

#### 테이블 구조

**1. motorcycles (오토바이)**
- id, plate_number (번호판), vehicle_name (차량명)
- chassis_number (차대번호), mileage (키로수), model_year (연식)
- insurance_company (보험사), insurance_start_date, insurance_end_date
- driving_range (운전범위), owner_name (명의자)
- insurance_fee (보험료), vehicle_price (차량가격)
- **daily_rental_fee (일대여료)**
- **usage_notes (사용 현황 메모)**
- status (상태: available/rented/maintenance)

**2. customers (고객)**
- id, name (이름), resident_number (주민번호)
- phone (전화번호), address (주소), license_type (면허종류)

**3. contracts (계약서)**
- id, contract_type (리스/렌트), contract_number (계약번호)
- motorcycle_id, customer_id
- start_date, end_date (계약기간)
- **daily_rental_fee (일대여료)**, deposit (보증금)
- special_terms (특약사항)
- signature_data (서명 base64)
- **id_card_photo (신분증 사진 base64)**
- status (상태: active/completed/cancelled)

**4. loan_contracts (차용증) 🆕**
- id, loan_number (차용증 번호)
- borrower_name, borrower_resident_number, borrower_phone, borrower_address (차용인)
- lender_name, lender_resident_number, lender_phone, lender_address (대여인)
- loan_amount (차용금액), loan_date (차용일), repayment_date (상환일)
- interest_rate (이자율), repayment_method (상환방법)
- collateral (담보), special_terms (특약사항)
- borrower_signature, lender_signature (이중 서명)
- borrower_id_card_photo (차용인 신분증)
- status (상태: active/completed/overdue/cancelled)

### API 엔드포인트

#### 오토바이 API
- `GET /api/motorcycles` - 목록 조회 (상태 필터 가능)
- `GET /api/motorcycles/:id` - 상세 조회
- `GET /api/motorcycles/:id/contracts` - **오토바이별 계약 이력 조회**
- `POST /api/motorcycles` - 등록
- `PUT /api/motorcycles/:id` - 수정
- `DELETE /api/motorcycles/:id` - 삭제

#### 고객 API
- `GET /api/customers` - 목록 조회
- `GET /api/customers/:id` - 상세 조회
- `POST /api/customers` - 등록
- `PUT /api/customers/:id` - 수정

#### 계약서 API
- `GET /api/contracts` - 목록 조회 (JOIN으로 관련 정보 포함)
- `GET /api/contracts/:id` - 상세 조회
- `POST /api/contracts` - 생성
- `PATCH /api/contracts/:id/status` - 상태 변경

#### 차용증 API 🆕
- `GET /api/loan-contracts` - 목록 조회
- `GET /api/loan-contracts/:id` - 상세 조회
- `POST /api/loan-contracts` - 생성
- `PATCH /api/loan-contracts/:id/status` - 상태 변경

## 📱 사용 가이드

### 1. 오토바이 등록
1. 메인 페이지에서 "오토바이 관리" 클릭
2. "오토바이 등록" 버튼 클릭
3. 모든 필수 정보 입력
4. 저장 버튼 클릭

### 2. 계약서 작성
1. 메인 페이지에서 "계약서 작성" 클릭
2. 계약 타입 선택 (리스/렌트)
3. 사용 가능한 오토바이 선택
4. 고객 정보 입력
5. 계약 상세 정보 입력 (기간, 금액 등)
6. 서명 박스에 고객 서명 받기
7. "계약서 생성" 버튼 클릭

### 3. 계약서 조회
1. 메인 페이지에서 "계약서 목록" 클릭
2. 필터/검색으로 원하는 계약서 찾기
3. "상세보기" 버튼으로 전체 내용 확인
4. PDF 다운로드 (추후 구현 예정)

## 🚀 배포 정보

### 플랫폼
- **배포 플랫폼**: Cloudflare Pages
- **데이터베이스**: Cloudflare D1 (SQLite)
- **상태**: ✅ 개발 서버 실행 중

### 기술 스택
- **Backend**: Hono (v4) + TypeScript
- **Frontend**: HTML5 + TailwindCSS + JavaScript (Vanilla)
- **Database**: Cloudflare D1 (SQLite)
- **Icons**: FontAwesome 6
- **HTTP Client**: Axios
- **Deployment**: Cloudflare Pages

### 로컬 개발
```bash
# 데이터베이스 마이그레이션
npm run db:migrate:local

# 빌드
npm run build

# 개발 서버 시작 (PM2)
pm2 start ecosystem.config.cjs

# 서버 상태 확인
pm2 list

# 로그 확인
pm2 logs --nostream
```

### 프로덕션 배포
```bash
# 프로덕션 데이터베이스 마이그레이션
npm run db:migrate:prod

# Cloudflare Pages 배포
npm run deploy:prod
```

## 📝 완료된 기능
- ✅ 오토바이 정보 등록 및 관리
- ✅ **일대여료 필드 추가**
- ✅ **사용 현황 메모 필드 추가**
- ✅ 보험 기간 진행률 시각화 (프로그레스 바)
- ✅ 보험 만료 경고 및 알림
- ✅ 번호판 클릭으로 계약 이력 조회
- ✅ 고객 정보 관리
- ✅ 리스/렌트 계약서 작성
- ✅ **신분증 촬영 기능 (웹캠/파일업로드)**
- ✅ 전자서명 (캔버스 기반)
- ✅ 계약서 목록 및 검색
- ✅ 계약서 상세 보기
- ✅ 자동 계약번호 생성
- ✅ 계약 상태 관리
- ✅ **차용증 작성 및 관리 시스템**
- ✅ **전문적인 차용증 약관 (8개 조항)**
- ✅ **이중 전자서명 (차용인/대여인)**
- ✅ 차용증 목록 및 상세 보기
- ✅ **관리자 회원가입/로그인 시스템**
- ✅ **계약서 공유 시스템 (SMS/카카오톡)**
- ✅ **CoolSMS API 연동 준비 완료**

### 5. 관리자 시스템 🆕
- ✅ 관리자 회원가입
  - 아이디, 이름, 이메일 입력
  - 비밀번호 확인 및 유효성 검증
  - 중복 아이디 체크
- ✅ 관리자 로그인/로그아웃
  - localStorage 기반 세션 관리
  - 자동 리다이렉트 (이미 로그인 시)
  - 실시간 로그인 상태 표시
- ✅ **계약서 공유 시스템**
  - SMS/카카오톡으로 계약서 링크 전송
  - 72시간 유효한 보안 토큰
  - 고객이 링크로 접속하여 서명
  - 서명 완료 시 자동 계약 생성

### 6. SMS 문자 전송 🆕
- ✅ CoolSMS API 연동 준비 완료
- ✅ 계약서 공유 링크 문자 발송
- ✅ 시뮬레이션 모드 지원 (테스트용)
- ⚙️ 실제 SMS 전송 (API 키 설정 필요)

## ⚙️ SMS 설정 가이드

### CoolSMS 가입 및 설정

1. **CoolSMS 가입**
   - https://www.coolsms.co.kr/ 접속
   - 회원가입 및 로그인

2. **발신번호 등록**
   - 대시보드 > 발신번호 관리
   - 사업자 등록증 또는 신분증 제출
   - 발신번호 승인 (1-2영업일)

3. **API Key 발급**
   - 대시보드 > API Key 관리
   - API Key 및 API Secret 생성
   - 테스트 크레딧 받기 (신규 가입 시 2,000원 제공)

4. **환경변수 설정**
   
   `.dev.vars` 파일에 다음 정보 입력:
   ```env
   # CoolSMS API 설정
   COOLSMS_API_KEY=your_api_key_here
   COOLSMS_API_SECRET=your_api_secret_here
   COOLSMS_SENDER=010-1234-5678
   ```

5. **프로덕션 배포 시 환경변수 설정**
   ```bash
   npx wrangler secret put COOLSMS_API_KEY
   npx wrangler secret put COOLSMS_API_SECRET
   npx wrangler secret put COOLSMS_SENDER
   ```

### SMS 요금 안내
- 일반 SMS (90바이트): 약 15원
- LMS (장문, 2000바이트): 약 45원
- 계약서 링크 전송 시 LMS 사용 권장

### SMS 전송 플로우
1. 관리자가 계약서 작성 완료
2. "고객에게 전송" 버튼 클릭
3. SMS 또는 카카오톡 선택
4. 고객 휴대폰 번호로 링크 전송
5. 고객이 링크 클릭하여 계약서 검토
6. 전자서명 및 신분증 업로드
7. 제출 시 자동으로 계약서 생성

## 🔜 향후 개선 사항
- ⏳ PDF 다운로드 기능 (jsPDF 라이브러리 사용)
- ⏳ 계약서 인쇄 최적화
- ⏳ 카카오 알림톡 연동
- ⏳ 계약 만료 알림
- ⏳ 통계 대시보드
- ⏳ 권한 관리 (일반 관리자/최고 관리자)
- ⏳ 계약서 템플릿 커스터마이징
- ⏳ 모바일 앱 버전

## 📄 라이선스
MIT License

## 👤 작성자
오토바이 리스/렌트 업체 관리자

## 📅 최종 업데이트
2026-01-30
