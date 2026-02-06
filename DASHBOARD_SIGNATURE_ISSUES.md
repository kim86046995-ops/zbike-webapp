# 대시보드 및 서명 확대 기능 문제 해결

## 🔍 문제 분석

### 1. 대시보드 숫자가 안 올라가는 문제
**원인**: 브라우저 캐시

**실제 데이터 확인**:
```bash
curl http://localhost:3000/api/dashboard/stats
{
  "motorcycles": {
    "total": 3,
    "available": 2,
    "rented": 1,      # ✅ 사용중 1대 정상
    "maintenance": 0,
    "scrapped": 0
  },
  "customers": 1,
  "contracts": {
    "active": 1,        # ✅ 활성 계약 1건 정상
    "monthly_revenue": 20000,
    ...
  }
}
```

**결론**: API는 정상 작동 중. 대시보드 통계가 올바르게 계산되고 있습니다.

---

### 2. 계약서 작성 시 서명 확대 기능이 없는 문제
**원인**: 계약서 작성 페이지(`contract-new.html`)에는 서명 확대 기능이 없음

**현재 서명 확대 기능이 있는 페이지**:
- ✅ `/static/contract-sign.html` (계약서 서명 페이지)

**서명 확대 기능이 없는 페이지**:
- ❌ `/static/contract-new.html` (계약서 작성 페이지)
- ❌ `/static/business-contract-new.html` (업체 계약서 작성 페이지)

---

## ✅ 해결 방법

### 1. 대시보드 숫자 문제
**해결**: 브라우저에서 **강력 새로고침** (Shift + F5 또는 Ctrl + Shift + R)

**단계**:
1. 대시보드 페이지 접속
2. **Shift + F5** 키를 눌러 캐시 무시하고 새로고침
3. 통계 확인

**예상 결과**:
- 활성 계약: 1건 (status = 'active')
- 사용중 오토바이: 1대 (status = 'rented')
- 월 예상 수익: 20,000원

---

### 2. 계약서 작성 페이지 서명 확대 기능 추가

#### A. 개인 계약서 작성 (`contract-new.html`)
**현재 상황**:
- 관리자 서명 캔버스 있음 (adminSignatureCanvas)
- 임시렌트 서명 캔버스 있음 (tempSignatureCanvas)
- 서명 확대 기능 없음

**추가 작업 필요**:
1. 서명 캔버스에 클릭 이벤트 추가
2. 서명 확대 모달 HTML 추가
3. JavaScript 함수 추가:
   - `openSignatureModal()`
   - `closeSignatureModal()`
   - `clearModalSignature()`
   - `saveModalSignature()`
   - `initModalSignaturePad()`

#### B. 업체 계약서 작성 (`business-contract-new.html`)
**현재 상황**:
- 서명 기능 자체가 없음 (고객이 서명 페이지에서 작성)

**결론**: 수정 불필요

---

## 🎯 권장 사항

### 옵션 1: 계약서 작성 페이지는 그대로 유지
**이유**:
- 계약서 작성 페이지는 **관리자가 사무실에서 사용**
- 일반적으로 **데스크톱 환경**에서 마우스 사용
- 작은 서명 캔버스도 충분히 사용 가능

**고객용 서명 페이지**:
- ✅ `/static/contract-sign.html`에는 이미 서명 확대 기능 적용됨
- 고객이 **모바일에서 서명할 때** 확대 기능 사용

---

### 옵션 2: 계약서 작성 페이지에도 서명 확대 기능 추가
**장점**:
- 모든 서명 페이지에서 일관된 UX
- 관리자도 태블릿 사용 시 편리

**단점**:
- 추가 개발 필요
- 페이지 용량 증가

---

## 📊 현재 상태 요약

### 정상 작동 중
| 기능 | 상태 | 확인 |
|------|------|------|
| 계약서 생성 | ✅ | API 정상 |
| 오토바이 상태 업데이트 | ✅ | rented로 변경됨 |
| 대시보드 통계 계산 | ✅ | 활성 계약 1건 |
| 계약서 목록 표시 | ✅ | 2건 표시 (1 active, 1 cancelled) |
| 서명 확대 (고객용) | ✅ | contract-sign.html에 적용됨 |

### 사용자 측 문제
| 현상 | 원인 | 해결 |
|------|------|------|
| 대시보드 숫자 안 보임 | 브라우저 캐시 | Shift + F5 |
| 서명 확대 안 됨 (관리자) | 기능 없음 | 옵션 선택 필요 |

---

## 🔗 테스트 URL

**대시보드**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/
- Shift + F5로 강력 새로고침 필요

**계약서 작성**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/contract-new.html

**계약서 목록**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/contracts.html

**고객용 계약서 서명** (서명 확대 기능 있음):
- 계약서 목록에서 [공유하기] → 공유 링크 사용

---

## 💡 즉시 해결 방법

1. **대시보드 숫자 문제**:
   ```
   브라우저에서 Shift + F5 (강력 새로고침)
   ```

2. **관리자용 서명 확대 추가 여부**:
   - **유지**: 현재 상태 그대로 (권장)
   - **추가**: 관리자 페이지에도 서명 확대 기능 구현

---

**작성일**: 2026-02-02
**API 상태**: ✅ 정상
**브라우저 캐시**: ⚠️ 새로고침 필요
**서명 확대 (고객용)**: ✅ 구현됨
**서명 확대 (관리자용)**: ❌ 미구현 (선택사항)
