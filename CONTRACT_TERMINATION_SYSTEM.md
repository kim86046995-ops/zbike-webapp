# 통합 계약 해지 시스템

## 구현 완료

### 🎯 요구사항
1. **총 바이크에서 계약 해지** → 모든 관련 계약에 자동 적용
2. **계약서 목록** → 해지 표시하되 기록 보존
3. **대시보드 (개인계약 보드)** → 진행중인 계약만 표시

---

## ✅ 구현 내용

### 1. 통합 계약 해지 시스템

#### 📍 오토바이 관리 페이지에서 해지
**위치**: `/static/motorcycles.html`

**동작 흐름**:
```
1. [해지] 버튼 클릭
2. 확인 다이얼로그 표시
3. 해당 오토바이의 진행중인 모든 계약 조회
4. 각 계약을 'cancelled' 상태로 변경
5. 오토바이 상태를 'available'로 변경
6. 계약 정보 및 보험 정보 초기화
7. 완료 메시지 표시 (해지된 계약 수 포함)
```

**해지 시 처리 내용**:
- ✅ 오토바이 상태 → '휴차중(available)'
- ✅ 계약 정보 초기화 (월임대료, 계약기간 등)
- ✅ 보험 정보 초기화 (보험사, 보험기간 등)
- ✅ 기본 정보 유지 (번호판, 차대번호, 차량명 등)
- ✅ 관련 모든 계약서 상태 → 'cancelled' (기록 보존)

---

### 2. 백엔드 API 수정

#### A. 계약서 상태 변경 API
**엔드포인트**: `PATCH /api/contracts/:id/status`

**Before**:
```typescript
// 계약서 상태만 변경
await DB.prepare('UPDATE contracts SET status = ? WHERE id = ?')
  .bind(status, id).run()

// 오토바이 상태만 변경
if (status === 'completed' || status === 'cancelled') {
  await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?')
    .bind('available', motorcycle_id).run()
}
```

**After**:
```typescript
// 1. 계약서 상태 변경 (기록 보존)
await DB.prepare('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  .bind(status, id).run()

// 2. 해지/완료 시 추가 처리
if (status === 'completed' || status === 'cancelled') {
  // 2-1. 오토바이 상태를 '휴차중'으로 변경
  await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?')
    .bind('available', motorcycleId).run()
  
  // 2-2. 오토바이의 계약 정보 및 보험 정보 초기화
  await DB.prepare(`
    UPDATE motorcycles 
    SET monthly_fee = NULL,
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
  `).bind(motorcycleId).run()
}
```

---

### 3. 프론트엔드 수정

#### A. terminateMotorcycle 함수 개선
**파일**: `/public/static/motorcycles.html`

**Before**:
```javascript
async function terminateMotorcycle(id) {
  // 오토바이 정보만 직접 업데이트
  await axios.put(`/api/motorcycles/${id}`, {
    status: 'available',
    monthly_fee: 0,
    contract_type_text: '',
    // ... 기타 필드 초기화
  });
}
```

**After**:
```javascript
async function terminateMotorcycle(id) {
  // 1. 해당 오토바이의 진행중인 모든 계약 조회
  const contractsResponse = await axios.get(`/api/motorcycles/${id}/contracts`, {
    headers: { 'X-Session-ID': sessionId }
  });
  
  const activeContracts = contractsResponse.data.filter(c => c.status === 'active');
  
  // 2. 모든 진행중인 계약을 'cancelled' 상태로 변경
  for (const contract of activeContracts) {
    await axios.patch(`/api/contracts/${contract.id}/status`, 
      { status: 'cancelled' },
      { headers: { 'X-Session-ID': sessionId } }
    );
  }
  
  // 3. 오토바이 상태 변경 (API가 자동으로 계약/보험 정보 초기화)
  await axios.patch(`/api/motorcycles/${id}/status`, 
    { status: 'available' },
    { headers: { 'X-Session-ID': sessionId } }
  );
  
  // 4. 완료 메시지 (해지된 계약 수 표시)
  alert(`✅ 계약이 해지되었습니다.\n\n해지된 계약서: ${activeContracts.length}건 (기록 보존)`);
}
```

---

### 4. 계약 상태 관리

#### 계약 상태 정의
```typescript
type ContractStatus = 'active' | 'completed' | 'cancelled'
```

| 상태 | 의미 | 표시 위치 | 색상 |
|------|------|-----------|------|
| `active` | 진행중 | 대시보드 + 계약서 목록 | 초록색 |
| `completed` | 정상 완료 | 계약서 목록만 | 회색 |
| `cancelled` | 해지됨 | 계약서 목록만 | 빨간색 |

---

### 5. 데이터 보존 전략

#### 계약서 목록 (contracts.html)
```javascript
// 모든 상태의 계약서 표시 (필터링 가능)
const statusFilter = document.getElementById('statusFilter').value;

filteredContracts = contracts.filter(c => {
  const matchStatus = !statusFilter || c.status === statusFilter;
  return matchStatus; // 해지된 계약서도 포함
});
```

**결과**: 
- ✅ 해지된 계약서도 목록에 표시
- ✅ '취소' 배지로 명확히 구분
- ✅ 모든 계약 이력 보존
- ✅ 상세보기, PDF 다운로드 가능

#### 대시보드 (index.tsx)
```typescript
// 통계 API: 진행중인 계약만 집계
const contractStats = await DB.prepare(`
  SELECT 
    COUNT(*) as active_contracts,
    SUM(CAST(monthly_fee as INTEGER)) as total_monthly_revenue
  FROM contracts
  WHERE status = 'active'  // 진행중인 계약만
`).first()
```

**결과**:
- ✅ 대시보드에는 진행중인 계약만 표시
- ✅ 활성 계약 수 정확히 집계
- ✅ 월 예상 수익 정확히 계산

---

## 🔄 전체 해지 프로세스

### 시나리오: 오토바이 A의 계약 해지

```
초기 상태:
- 오토바이 A: status = 'rented' (사용중)
- 계약서 1: status = 'active' (진행중)
- 계약서 2: status = 'active' (진행중)

[해지] 버튼 클릭
   ↓
1. 진행중인 계약 조회
   → 계약서 1, 2 발견
   ↓
2. 각 계약 상태 변경
   → 계약서 1: status = 'cancelled'
   → 계약서 2: status = 'cancelled'
   ↓
3. 오토바이 상태 변경
   → 오토바이 A: status = 'available'
   ↓
4. 계약/보험 정보 초기화
   → monthly_fee = NULL
   → contract_start_date = NULL
   → insurance_company = NULL
   → (기타 계약 관련 필드)
   ↓
최종 상태:
- 오토바이 A: status = 'available' (휴차중), 계약 정보 없음
- 계약서 1: status = 'cancelled' (기록 보존)
- 계약서 2: status = 'cancelled' (기록 보존)

대시보드: 계약서 1, 2 표시 안 됨 (진행중만 표시)
계약서 목록: 계약서 1, 2 표시됨 (빨간색 '취소' 배지)
```

---

## 📊 화면별 동작

### 1. 대시보드 (메인 페이지)
**URL**: `/`

**표시 내용**:
- ✅ 활성 계약 수 (status = 'active'만)
- ✅ 월 예상 수익 (활성 계약의 합계)
- ✅ 오토바이 통계 (전체/사용중/휴차중/수리중)

**해지 후 변화**:
- 활성 계약 수 감소
- 월 예상 수익 감소
- 사용중 오토바이 수 감소
- 휴차중 오토바이 수 증가

---

### 2. 오토바이 관리 페이지
**URL**: `/static/motorcycles.html`

**[해지] 버튼**:
- 위치: 각 오토바이 카드의 '사용중' 상태일 때만 표시
- 색상: 주황색 (bg-orange-500)
- 아이콘: fas fa-hand-stop-o

**해지 확인 다이얼로그**:
```
계약을 해지하시겠습니까?

해지하면:
✓ 오토바이 상태가 "휴차중"으로 변경됩니다
✓ 계약 정보가 초기화됩니다
✓ 보험 정보가 초기화됩니다
✓ 기본 정보는 유지됩니다
✓ 관련 계약서는 "해지" 상태로 보존됩니다
```

**해지 완료 메시지**:
```
✅ 계약이 해지되었습니다.

• 오토바이 상태: 휴차중
• 계약 정보: 초기화됨
• 보험 정보: 초기화됨
• 기본 정보: 유지됨
• 해지된 계약서: 2건 (기록 보존)
```

---

### 3. 계약서 목록 페이지
**URL**: `/static/contracts.html`

**표시 내용**:
- ✅ 모든 상태의 계약서 표시
- ✅ 상태 필터 (전체/진행중/완료/취소)
- ✅ 각 계약서에 상태 배지 표시

**상태 배지**:
| 상태 | 텍스트 | 배경색 | 텍스트색 |
|------|--------|--------|---------|
| active | 진행중 | bg-green-100 | text-green-800 |
| completed | 완료 | bg-gray-100 | text-gray-800 |
| cancelled | 취소 | bg-red-100 | text-red-800 |

**해지된 계약서**:
- ✅ 목록에 계속 표시
- ✅ '취소' 배지로 명확히 구분
- ✅ 상세보기 가능
- ✅ PDF 다운로드 가능
- ✅ 모든 정보 보존

---

## 🧪 테스트 시나리오

### 시나리오 1: 단일 계약 해지
```
1. 오토바이 A에 계약서 1개 진행중
2. [해지] 버튼 클릭
3. 확인
4. 결과:
   - 오토바이 A: 휴차중
   - 계약서 1: 취소 (기록 보존)
   - 대시보드: 활성 계약 -1
   - 계약서 목록: 계약서 1 표시 (빨간색 배지)
```

### 시나리오 2: 다중 계약 해지
```
1. 오토바이 B에 계약서 3개 진행중
2. [해지] 버튼 클릭
3. 확인
4. 결과:
   - 오토바이 B: 휴차중
   - 계약서 1, 2, 3: 모두 취소 (기록 보존)
   - 대시보드: 활성 계약 -3
   - 계약서 목록: 3건 모두 표시 (빨간색 배지)
   - 완료 메시지: "해지된 계약서: 3건"
```

### 시나리오 3: 계약서 목록에서 확인
```
1. 계약 해지 후
2. /static/contracts.html 접속
3. 상태 필터: "취소" 선택
4. 결과:
   - 해지된 모든 계약서 표시
   - 각 계약서에 '취소' 배지
   - 상세보기/PDF 다운로드 가능
```

### 시나리오 4: 대시보드 통계 확인
```
1. 계약 해지 전: 활성 계약 10건, 월 수익 500만원
2. 계약 1건 해지 (월 50만원)
3. 대시보드 새로고침
4. 결과:
   - 활성 계약: 9건
   - 월 예상 수익: 450만원
   - 사용중: -1
   - 휴차중: +1
```

---

## 🎯 주요 개선 사항

### Before (이전)
❌ 오토바이에서 해지해도 계약서 상태 변경 안 됨  
❌ 계약서 목록과 대시보드 간 데이터 불일치  
❌ 해지된 계약서가 대시보드에 계속 표시  
❌ 수동으로 각 계약서 상태 변경 필요

### After (개선 후)
✅ 오토바이 해지 시 모든 관련 계약 자동 처리  
✅ 계약서 목록과 대시보드 데이터 일관성 유지  
✅ 대시보드에는 진행중인 계약만 표시  
✅ 한 번의 클릭으로 모든 계약 해지  
✅ 계약 이력은 완전히 보존 (감사 추적 가능)

---

## 📄 관련 API 엔드포인트

### 1. 계약서 상태 변경
```
PATCH /api/contracts/:id/status
Body: { status: 'cancelled' }
Headers: { 'X-Session-ID': sessionId }

→ 계약서 상태 변경 + 오토바이 정보 초기화
```

### 2. 오토바이 상태 변경
```
PATCH /api/motorcycles/:id/status
Body: { status: 'available' }
Headers: { 'X-Session-ID': sessionId }

→ 오토바이 상태 변경 + 계약/보험 정보 초기화
```

### 3. 오토바이 계약 이력 조회
```
GET /api/motorcycles/:id/contracts
Headers: { 'X-Session-ID': sessionId }

→ 해당 오토바이의 모든 계약 목록 (진행중/완료/취소)
```

### 4. 대시보드 통계
```
GET /api/dashboard/stats

→ 활성 계약만 집계 (status = 'active')
```

---

## 🔒 권한 관리

**인증 필요 작업**:
- ✅ 계약 해지 (`authMiddleware`)
- ✅ 계약서 상태 변경 (`authMiddleware`)
- ✅ 오토바이 상태 변경 (`authMiddleware`)

**확인 다이얼로그**:
- ✅ 해지 전 반드시 확인 요청
- ✅ 해지 내용 명확히 안내
- ✅ 돌이킬 수 없음 경고

---

## 🎉 결과

### 통합된 해지 시스템
- ✅ **한 곳에서 해지** → 모든 곳에 자동 반영
- ✅ **기록 완벽 보존** → 감사 추적 가능
- ✅ **데이터 일관성** → 계약서 목록과 대시보드 동기화
- ✅ **사용자 편의성** → 한 번의 클릭으로 완료
- ✅ **명확한 구분** → 진행중 vs 해지됨

---

## 🔗 테스트 URL

**대시보드**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/

**오토바이 관리**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/motorcycles.html

**계약서 목록**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/contracts.html

**테스트 계정**:
- 아이디: `sangchun11`
- 비밀번호: `a2636991!@#`

---

**구현 완료일**: 2026-02-02  
**수정 파일**: 
- `/home/user/webapp/src/index.tsx` (계약 상태 변경 API)
- `/home/user/webapp/public/static/motorcycles.html` (terminateMotorcycle 함수)
