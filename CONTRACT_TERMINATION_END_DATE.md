# 계약 해지 시 종료일 자동 설정 기능

## 개요
계약 해지 또는 완료 시 **종료일(end_date)을 자동으로 오늘 날짜로 업데이트**하는 기능을 구현했습니다.

---

## 주요 기능

### 1. 자동 종료일 설정
- **해지 시점**: 계약 상태가 `cancelled` 또는 `completed`로 변경될 때
- **자동 설정**: `end_date` 필드를 오늘 날짜(YYYY-MM-DD)로 자동 업데이트
- **기록 보존**: 계약서 목록에서 정확한 해지일/완료일 확인 가능

### 2. 적용 범위
- ✅ **개인 계약 해지**: 계약서 목록에서 직접 해지
- ✅ **오토바이 해지**: 오토바이 관리 페이지에서 해지 (관련 모든 계약 자동 해지)
- ✅ **계약 완료**: 계약 완료 처리 시에도 동일하게 적용

---

## 구현 상세

### API 엔드포인트 수정
**PATCH `/api/contracts/:id/status`**

```typescript
// 계약서 상태 업데이트 (기록은 보존)
// 해지/완료 시 종료일을 오늘 날짜로 자동 설정
if (status === 'completed' || status === 'cancelled') {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD 형식
  await DB.prepare('UPDATE contracts SET status = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, today, id).run()
  console.log(`📅 Contract #${id} ${status} - end_date set to ${today}`)
} else {
  await DB.prepare('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id).run()
}
```

---

## 사용 시나리오

### 시나리오 1: 계약서 목록에서 직접 해지
1. 계약서 목록 페이지 접속
2. 특정 계약의 [해지] 버튼 클릭
3. 확인
4. **결과**: 
   - 상태: `진행중` → `취소`
   - 종료일: `2026-03-31` → `2026-02-02` (오늘)

### 시나리오 2: 오토바이 해지 (다중 계약 자동 해지)
1. 오토바이 관리 페이지 접속
2. 특정 오토바이의 [해지] 버튼 클릭
3. 확인
4. **결과**:
   - 관련된 모든 진행중인 계약이 자동 해지
   - 각 계약의 종료일이 모두 오늘 날짜로 설정

---

## 예시

### Before (해지 전)
```json
{
  "id": 5,
  "contract_number": "20260202-0005",
  "status": "active",
  "start_date": "2026-02-02",
  "end_date": "2026-03-31",
  "customer_name": "김상현",
  "plate_number": "12가3456"
}
```

### After (해지 후 - 오늘이 2026-02-02인 경우)
```json
{
  "id": 5,
  "contract_number": "20260202-0005",
  "status": "cancelled",
  "start_date": "2026-02-02",
  "end_date": "2026-02-02",  // ← 오늘 날짜로 자동 설정
  "customer_name": "김상현",
  "plate_number": "12가3456"
}
```

---

## UI 표시

### 계약서 목록 페이지
- **계약 기간**: `2026-02-02 ~ 2026-02-02` (해지일로 변경됨)
- **상태 배지**: `취소` (빨간색)
- **해지 정보**: 종료일이 해지 처리된 날짜로 표시

---

## 테스트 방법

### 1. 새 계약 생성
```
1. 로그인 (sangchun11 / a2636991!@#)
2. 계약서 작성 페이지 접속
3. 계약 정보 입력 후 저장
4. 종료일 확인 (예: 2026-03-31)
```

### 2. 계약 해지 테스트
```
1. 계약서 목록 페이지 접속
2. 방금 생성한 계약의 [해지] 버튼 클릭
3. 확인
4. 종료일 확인 → 오늘 날짜(2026-02-02)로 변경됨 ✅
```

### 3. 오토바이 해지 테스트
```
1. 오토바이 관리 페이지 접속
2. 계약 중인 오토바이의 [해지] 버튼 클릭
3. 확인
4. 계약서 목록에서 해당 오토바이의 모든 계약 확인
5. 모든 계약의 종료일이 오늘 날짜로 변경됨 ✅
```

---

## 개선 효과

### Before (이전)
- ❌ 해지해도 원래 종료일 그대로 유지
- ❌ 실제 해지일을 알 수 없음
- ❌ 계약 기간 계산 부정확

### After (개선 후)
- ✅ 해지 시 자동으로 오늘 날짜로 설정
- ✅ 정확한 해지일 기록
- ✅ 계약 기간 정확히 계산 가능
- ✅ 감사 추적(Audit Trail) 용이

---

## 관련 파일

### 수정된 파일
- `/home/user/webapp/src/index.tsx` - API 엔드포인트 로직 수정

### 관련 페이지
- 계약서 목록: `/static/contracts.html`
- 오토바이 관리: `/static/motorcycles.html`
- 대시보드: `/`

---

## 테스트 URL

- **대시보드**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/
- **계약서 목록**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/contracts.html
- **오토바이 관리**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/motorcycles.html

**테스트 계정**: 아이디 `sangchun11` / 비밀번호 `a2636991!@#`

---

## 기술 세부사항

### 날짜 형식
```javascript
const today = new Date().toISOString().split('T')[0]
// 결과: "2026-02-02" (YYYY-MM-DD)
```

### SQL 쿼리
```sql
UPDATE contracts 
SET status = ?, 
    end_date = ?, 
    updated_at = CURRENT_TIMESTAMP 
WHERE id = ?
```

### 로그 출력
```
📅 Contract #5 cancelled - end_date set to 2026-02-02
✅ Contract cancelled - Motorcycle #1 reset to available with cleared contract info
```

---

## 결론

계약 해지 시 종료일이 자동으로 오늘 날짜로 설정되어:
- ✅ **정확한 해지일 기록**
- ✅ **감사 추적 용이**
- ✅ **데이터 일관성 향상**
- ✅ **수동 입력 불필요**

모든 기능이 정상 작동합니다! 🚀

---

**구현 완료일**: 2026-02-02  
**수정 파일**: `/home/user/webapp/src/index.tsx`
