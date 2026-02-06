# 대시보드 및 계약 해지 기능 업데이트

## 📅 업데이트 일시
2026-02-02

## 🎯 주요 변경 사항

### 1. 새로운 운영현황 대시보드 (루트 경로)
- **URL**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
- **기능**: 오토바이 렌탈 사업 전체 현황을 한눈에 파악
- **위치**: 첫 화면 (루트 경로 `/`)

#### 대시보드 구성
1. **운영 통계 카드 4개** (클릭 시 오토바이 관리 페이지로 필터링 이동)
   - **총 바이크** (파란색): 전체 오토바이 수
   - **사용중** (초록색): 렌트 중인 오토바이 수
   - **휴차중** (노란색): 사용 가능한 오토바이 + 계약정보 없는 오토바이
   - **수리중/폐지** (빨간색): 정비 중 + 폐지된 오토바이

2. **추가 통계**
   - 활성 계약 수
   - 총 고객 수
   - 월 예상 수익

3. **빠른 액세스**
   - 오토바이 등록
   - 계약서 작성
   - 오토바이 목록
   - 계약서 목록

### 2. 계약 해지 기능 개선

#### 해지 시 데이터 처리
- **기본정보 유지**: 차량번호, 차량이름, 연식, 키로수, 차대번호
- **계약정보 초기화**: 대여료, 계약종류, 선납/보증금, 계약 시작일, 계약 종료일
- **보험정보 초기화**: 보험사, 명의자, 보험 시작일, 보험 종료일, 보험 운전범위
- **상태 변경**: `available` (사용 가능)로 변경

#### 백엔드 로직 (PATCH /api/motorcycles/:id/status)
```typescript
if (status === 'available') {
  // 해지 처리: 기본정보만 남기고 계약정보와 보험정보 초기화
  await DB.prepare(`
    UPDATE motorcycles 
    SET status = ?,
        monthly_fee = NULL,
        contract_type_text = NULL,
        deposit = NULL,
        contract_start_date = NULL,
        contract_end_date = NULL,
        insurance_company = NULL,
        insurance_start_date = NULL,
        insurance_end_date = NULL,
        driving_range = NULL,
        owner_name = NULL,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(status, id).run()
}
```

### 3. 휴차중 표시 로직 개선

#### 백엔드 통계 쿼리 (GET /api/dashboard/stats)
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE 
    WHEN status = 'available' 
      OR (status != 'maintenance' AND status != 'scrapped' 
          AND (monthly_fee IS NULL OR contract_start_date IS NULL))
    THEN 1 ELSE 0 
  END) as available,
  ...
FROM motorcycles
```

**휴차중 조건**:
- `status = 'available'` (명시적으로 사용 가능)
- **또는** 정비/폐지가 아니면서 계약정보가 없는 경우 (`monthly_fee IS NULL` 또는 `contract_start_date IS NULL`)

### 4. 카드 필터링 기능

#### 오토바이 관리 페이지 연동
- 대시보드 카드 클릭 시 `?status=` 파라미터로 오토바이 관리 페이지로 이동
- 오토바이 관리 페이지에서 URL 파라미터를 읽어 초기 필터 설정

```javascript
// URL 파라미터로 전달된 상태 필터 확인
const urlParams = new URLSearchParams(window.location.search);
const statusParam = urlParams.get('status');

if (statusParam) {
  const statusFilterElement = document.getElementById('statusFilter');
  if (statusParam === 'all') {
    statusFilterElement.value = '';
  } else if (statusParam === 'maintenance_scrapped') {
    statusFilterElement.value = 'maintenance';
  } else {
    statusFilterElement.value = statusParam;
  }
}
```

### 5. 보험 운전범위 드롭다운

#### 옵션 (7개)
- 선택하세요 (기본값)
- 전연령
- 만19세이상
- 만21세이상
- 만24세이상
- 만26세이상
- 만30세이상
- 만35세이상

## 📊 데이터베이스 변경

### 마이그레이션 (0006)
```sql
-- 계약 정보 컬럼 추가
ALTER TABLE motorcycles ADD COLUMN monthly_fee TEXT;
ALTER TABLE motorcycles ADD COLUMN contract_type_text TEXT;
ALTER TABLE motorcycles ADD COLUMN deposit TEXT;
ALTER TABLE motorcycles ADD COLUMN contract_start_date TEXT;
ALTER TABLE motorcycles ADD COLUMN contract_end_date TEXT;
```

## 🧪 테스트 방법

### 1. 대시보드 접속
```bash
# 루트 경로
https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/

# 통계 API
https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/api/dashboard/stats
```

### 2. 계약 해지 테스트
1. 오토바이 관리 페이지 접속
2. 렌트 중인 오토바이 선택 → 수정 클릭
3. 계약정보와 보험정보 확인
4. 해지 버튼 클릭
5. 다시 수정 클릭 → 계약정보와 보험정보가 초기화되었는지 확인
6. 대시보드에서 휴차중 수 증가 확인

### 3. 카드 필터링 테스트
1. 대시보드 접속
2. "사용중" 카드 클릭
3. 오토바이 관리 페이지로 이동 + `?status=rented` 필터 자동 적용 확인
4. 렌트 중인 오토바이만 표시되는지 확인

## 📝 API 엔드포인트

### GET /
- **설명**: 운영현황 대시보드 (새로운 첫 화면)
- **인증**: 불필요
- **응답**: HTML 페이지

### GET /api/dashboard/stats
- **설명**: 대시보드 통계 조회
- **인증**: 불필요 (변경됨)
- **응답**:
```json
{
  "motorcycles": {
    "total": 2,
    "available": 1,
    "rented": 0,
    "maintenance": 0,
    "scrapped": 1
  },
  "customers": 4,
  "contracts": {
    "active": 2,
    "monthly_revenue": 340000,
    "total_deposits": 120000
  }
}
```

### PATCH /api/motorcycles/:id/status
- **설명**: 오토바이 상태 변경 (해지 포함)
- **인증**: 필요
- **요청**:
```json
{
  "status": "available",  // 해지 시
  "usage_notes": ""       // 선택사항
}
```
- **동작**: 
  - `status = 'available'`: 계약정보와 보험정보 초기화
  - `status = 'scrapped'`: 폐지 처리 (기존 로직 유지)
  - 기타: 일반 상태 변경

## 🎨 UI/UX 개선

### 대시보드 디자인
- **반응형**: 모바일 2열, 데스크톱 4열 그리드
- **인터랙티브**: Hover 시 카드 확대 + 그림자 효과
- **직관적**: 색상 코딩 (파란/초록/노랑/빨강)으로 한눈에 현황 파악
- **클릭 가능**: 카드 클릭 시 해당 상태로 필터링된 오토바이 관리 페이지로 이동

### 보험 운전범위
- 텍스트 입력 → 드롭다운으로 변경
- 연령 기준 명확화

## 🔧 기술 스택
- **프론트엔드**: HTML, Tailwind CSS, Axios
- **백엔드**: Hono (Cloudflare Workers)
- **데이터베이스**: Cloudflare D1 (SQLite)

## 📈 향후 개선 사항
1. 대시보드 권한 관리 (로그인 후에만 접근)
2. 실시간 통계 업데이트 (WebSocket)
3. 차트 시각화 (Chart.js)
4. 월별/연도별 통계 조회
5. Excel/PDF 통계 다운로드 기능

## ✅ 완료 상태
- [x] 해지 시 기본정보만 남기고 계약정보/보험정보 초기화
- [x] 해지된 오토바이 휴차중에 표시
- [x] 기본정보만 있고 계약정보 없는 경우 휴차중 표시
- [x] 오토바이 관리 카드를 운영현황 대시보드로 이동
- [x] 기존 운영현황 카드 삭제 및 새로운 대시보드 생성
- [x] 보험 운전범위 드롭다운 (7개 옵션)
- [x] 대시보드 카드 클릭 시 필터링 기능

---
**업데이트 완료**: 2026-02-02
