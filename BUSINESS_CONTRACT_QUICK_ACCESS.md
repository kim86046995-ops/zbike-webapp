# 대시보드 빠른 액세스 업데이트 - 업체계약서 작성 추가

## 개요
메인 대시보드의 "빠른 액세스" 영역에서 "오토바이 목록"을 제거하고, "업체계약서 작성"으로 교체했습니다. 업체계약서 작성 완료 후 자동으로 업체계약서 목록으로 이동하도록 설정했습니다.

## 변경 내용

### 1. 대시보드 빠른 액세스 수정

#### Before (이전)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 오토바이등록 │ 계약서작성  │ 오토바이목록 │ 계약서목록  │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### After (현재)
```
┌─────────────┬─────────────┬───────────────┬─────────────┐
│ 오토바이등록 │ 계약서작성  │ 업체계약서작성 │ 계약서목록  │
└─────────────┴─────────────┴───────────────┴─────────────┘
```

### 2. 업체계약서 작성 버튼

**위치**: 메인 대시보드(`/`) → 빠른 액세스 3번째

**디자인**:
- 배경색: 보라색 (`bg-purple-50`, `hover:bg-purple-100`)
- 아이콘: 건물 아이콘 (`fa-building`)
- 텍스트: "업체계약서 작성"

**링크**: `/static/business-contract-new.html`

### 3. 업체계약서 작성 페이지

**파일**: `/home/user/webapp/public/static/business-contract-new.html`

**주요 기능**:
- ✅ 업체 정보 입력 (업체명, 대표자, 사업자번호, 연락처, 주소)
- ✅ 오토바이 선택
- ✅ 계약 조건 입력 (월 렌트비, 보증금, 계약 기간)
- ✅ 계약 유형: 업체 리스/렌트 계약
- ✅ API 연동: `POST /api/business-contracts`

**작성 완료 후 동작**:
```javascript
// Before
window.location.href = '/business-contracts';

// After
window.location.href = '/static/contracts.html?type=business&status=active';
```

**결과**: 업체계약서 작성 완료 → 계약서 목록 페이지로 이동 → 자동으로 "업체계약" 및 "진행중" 필터 적용

## 코드 변경 내역

### src/index.tsx (대시보드)

**변경 전**:
```html
<a href="/static/motorcycles.html" class="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-center transition">
    <i class="fas fa-list text-3xl text-purple-600 mb-2"></i>
    <p class="text-sm font-medium text-gray-700">오토바이 목록</p>
</a>
```

**변경 후**:
```html
<a href="/static/business-contract-new.html" class="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-center transition">
    <i class="fas fa-building text-3xl text-purple-600 mb-2"></i>
    <p class="text-sm font-medium text-gray-700">업체계약서 작성</p>
</a>
```

### public/static/business-contract-new.html

**변경 전**:
```javascript
window.location.href = '/business-contracts';
```

**변경 후**:
```javascript
window.location.href = '/static/contracts.html?type=business&status=active';
```

## 사용자 흐름

### 업체계약서 작성 플로우

```
1. 메인 대시보드 접속
   ↓
2. "빠른 액세스" → "업체계약서 작성" 클릭
   ↓
3. 업체계약서 작성 페이지 (/static/business-contract-new.html)
   ├─ 업체 정보 입력
   ├─ 오토바이 선택
   └─ 계약 조건 입력
   ↓
4. "계약서 생성" 버튼 클릭
   ↓ (POST /api/business-contracts)
   ↓
5. 계약서 생성 성공 알림
   ↓
6. 자동 이동: /static/contracts.html?type=business&status=active
   ├─ 업체계약 필터 자동 적용
   └─ 진행중 상태 필터 자동 적용
   ↓
7. 방금 작성한 업체계약서 확인
```

## 대시보드 빠른 액세스 완전 매핑

| 번호 | 아이콘 | 색상 | 텍스트 | 링크 | 기능 |
|------|--------|------|--------|------|------|
| 1 | 플러스 | 파란색 | 오토바이 등록 | `/static/motorcycles-new.html` | 새 오토바이 등록 |
| 2 | 서명 | 초록색 | 계약서 작성 | `/static/contract-new.html` | 개인 계약서 작성 |
| 3 | 건물 | 보라색 | 업체계약서 작성 | `/static/business-contract-new.html` | 업체 계약서 작성 |
| 4 | 폴더 | 주황색 | 계약서 목록 | `/static/contracts.html` | 전체 계약서 목록 |

## 테스트 결과

### 1. 대시보드 빠른 액세스 확인
```bash
✅ 오토바이 등록
✅ 계약서 작성
✅ 업체계약서 작성 (새로 추가!)
✅ 계약서 목록
```

### 2. 업체계약서 작성 페이지 로드
```bash
✅ URL: /static/business-contract-new.html
✅ 페이지 로드 성공
✅ 업체 계약서 폼 표시
```

### 3. 작성 완료 후 이동
```bash
✅ 계약 생성 API: POST /api/business-contracts
✅ 이동 URL: /static/contracts.html?type=business&status=active
✅ 업체계약 필터 자동 적용
✅ 진행중 필터 자동 적용
```

## API 엔드포인트

### POST /api/business-contracts

**요청 데이터**:
```json
{
  "motorcycle_id": 1,
  "company_name": "ABC 배달업체",
  "representative_name": "홍길동",
  "business_number": "123-45-67890",
  "phone": "010-1234-5678",
  "address": "서울시 강남구...",
  "monthly_fee": 350000,
  "deposit": 1000000,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "payment_day": 5
}
```

**응답 데이터**:
```json
{
  "id": 1,
  "contract_number": "BC-20240101-001",
  "company_name": "ABC 배달업체",
  "status": "active",
  "created_at": "2024-01-01 10:00:00"
}
```

## 비즈니스 가치

### ✅ 장점

1. **접근성 향상**: 
   - 메인 대시보드에서 원클릭으로 업체계약서 작성
   - 오토바이 목록은 상단 "총 바이크" 카드를 통해 접근 가능

2. **작업 효율성**:
   - 업체계약서 작성 → 자동 필터링된 목록으로 이동
   - 즉시 작성한 계약서 확인 가능

3. **UI 일관성**:
   - 4개의 빠른 액세스 버튼이 각각 다른 색상으로 구분
   - 명확한 아이콘으로 기능 구분

4. **사용자 경험**:
   - 계약서 작성 후 관련 목록으로 자동 이동
   - type=business & status=active 파라미터로 즉시 필터링

## 오토바이 목록 접근 방법

오토바이 목록이 빠른 액세스에서 제거되었지만, 여전히 접근 가능합니다:

### 방법 1: 총 바이크 카드 클릭
```
메인 대시보드 → "총 바이크" 파란색 카드 클릭
→ /static/motorcycles.html?status= (전체 오토바이 목록)
```

### 방법 2: 직접 URL 입력
```
https://도메인/static/motorcycles.html
```

### 방법 3: 계약서 작성 페이지에서
```
계약서 작성 → 오토바이 선택 드롭다운 → "오토바이 관리" 링크
```

## 향후 개선 가능 사항

1. **임시계약서 작성**: 임시계약서 작성 페이지 추가
2. **차용증 작성**: 차용증 작성 빠른 액세스 추가 고려
3. **동적 필터**: URL 파라미터를 통한 더 세밀한 필터링
4. **알림 개선**: 작성 완료 후 토스트 알림 추가

## 테스트 URL

- **메인 대시보드**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
- **업체계약서 작성**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/business-contract-new.html
- **업체계약 목록**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/contracts.html?type=business&status=active

---

**작성일**: 2026-02-02
**마지막 업데이트**: 2026-02-02 10:05
**담당자**: AI Developer
