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
  - 보험료, 차량금액
  - 상태 (사용가능/렌트중/정비중)
- ✅ 오토바이 목록 조회 및 필터링
- ✅ 오토바이 정보 수정/삭제
- ✅ 실시간 상태 관리

### 2. 계약서 작성
- ✅ 계약 타입 선택 (리스/렌트)
- ✅ 사용 가능한 오토바이 선택
- ✅ 고객 정보 입력
  - 이름, 주민번호
  - 전화번호, 주소
  - 면허종류 (2종 소형, 2종 보통, 1종 보통, 1종 대형)
- ✅ 계약 상세 정보
  - 계약 기간 (시작일~종료일)
  - 월 납부금액, 보증금
  - 특약사항
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
- ✅ 계약 상태 관리 (진행중/완료/취소)

## 📊 데이터 아키텍처

### 데이터베이스: Cloudflare D1 (SQLite)

#### 테이블 구조

**1. motorcycles (오토바이)**
- id, plate_number (번호판), vehicle_name (차량명)
- chassis_number (차대번호), mileage (키로수), model_year (연식)
- insurance_company (보험사), insurance_start_date, insurance_end_date
- driving_range (운전범위), owner_name (명의자)
- insurance_fee (보험료), vehicle_price (차량가격)
- status (상태: available/rented/maintenance)

**2. customers (고객)**
- id, name (이름), resident_number (주민번호)
- phone (전화번호), address (주소), license_type (면허종류)

**3. contracts (계약서)**
- id, contract_type (리스/렌트), contract_number (계약번호)
- motorcycle_id, customer_id
- start_date, end_date (계약기간)
- monthly_fee (월납부금), deposit (보증금)
- special_terms (특약사항), signature_data (서명 base64)
- status (상태: active/completed/cancelled)

### API 엔드포인트

#### 오토바이 API
- `GET /api/motorcycles` - 목록 조회 (상태 필터 가능)
- `GET /api/motorcycles/:id` - 상세 조회
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
- ✅ 고객 정보 관리
- ✅ 리스/렌트 계약서 작성
- ✅ 전자서명 (캔버스 기반)
- ✅ 계약서 목록 및 검색
- ✅ 계약서 상세 보기
- ✅ 자동 계약번호 생성
- ✅ 계약 상태 관리

## 🔜 향후 개선 사항
- ⏳ PDF 다운로드 기능 (jsPDF 라이브러리 사용)
- ⏳ 계약서 인쇄 최적화
- ⏳ SMS/이메일 계약서 전송
- ⏳ 계약 만료 알림
- ⏳ 통계 대시보드
- ⏳ 사용자 인증/권한 관리
- ⏳ 계약서 템플릿 커스터마이징
- ⏳ 모바일 앱 버전

## 📄 라이선스
MIT License

## 👤 작성자
오토바이 리스/렌트 업체 관리자

## 📅 최종 업데이트
2026-01-30
