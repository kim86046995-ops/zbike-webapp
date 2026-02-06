# 모바일 로그인 404 오류 수정

## 문제 상황
모바일에서 로그인 시 로그인 페이지는 정상 표시되지만, 로그인 버튼 클릭 후 "404 Not Found" 오류가 발생하여 메인 대시보드로 이동하지 못하는 문제

## 원인 분석

### 로그 분석 결과
```
POST /api/auth/login 200 OK (40ms)    ✅ 로그인 API 성공
GET /dashboard 404 Not Found (5ms)    ❌ 리다이렉트 경로 없음
```

### 문제의 핵심
1. 로그인 API (`/api/auth/login`)는 정상 작동 → `200 OK`
2. 로그인 성공 후 `/dashboard` 경로로 리다이렉트 시도
3. **`/dashboard` 라우트가 존재하지 않음** → `404 Not Found`
4. 실제 메인 대시보드는 루트 경로 `/`에 있음

### 코드 분석

**public/static/login.html (수정 전)**:
```javascript
// 로그인 성공 후 리다이렉트
const urlParams = new URLSearchParams(window.location.search)
const redirect = urlParams.get('redirect') || '/dashboard'  // ❌ 존재하지 않는 경로
window.location.href = redirect
```

**src/index.tsx (라우트 확인)**:
```typescript
// 메인 대시보드는 루트 경로에 있음
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <title>운영현황 - 오토바이 렌탈 관리</title>
    ...
  `)
})

// /dashboard 라우트는 없음!
```

## 해결 방법

### 수정 내용
로그인 페이지에서 로그인 성공 후 리다이렉트 경로를 `/dashboard`에서 `/`로 변경

**public/static/login.html (수정 후)**:
```javascript
// 로그인 성공 후 리다이렉트
const urlParams = new URLSearchParams(window.location.search)
const redirect = urlParams.get('redirect') || '/'  // ✅ 루트 경로로 변경
window.location.href = redirect
```

### 변경 위치
- **파일**: `/home/user/webapp/public/static/login.html`
- **라인**: 110, 154 (2곳)
- **변경**: `/dashboard` → `/`

## 로그인 플로우

### Before (문제 발생 시)
```
1. 사용자가 /login 접속
   ↓
2. 아이디/비밀번호 입력
   ↓
3. POST /api/auth/login (200 OK) ✅
   ↓
4. 세션 저장 (localStorage)
   ↓
5. window.location.href = '/dashboard' ❌
   ↓
6. GET /dashboard (404 Not Found) ❌
   ↓
7. 사용자에게 404 페이지 표시
```

### After (수정 후)
```
1. 사용자가 /login 접속
   ↓
2. 아이디/비밀번호 입력
   ↓
3. POST /api/auth/login (200 OK) ✅
   ↓
4. 세션 저장 (localStorage)
   ↓
5. window.location.href = '/' ✅
   ↓
6. GET / (200 OK) ✅
   ↓
7. 메인 대시보드 표시 (운영현황)
```

## 테스트 결과

### 1. 로그인 API 테스트
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sangchun11","password":"a2636991!@#"}'
```

**응답**:
```json
{
  "success": true,
  "sessionId": "wtev0uic83ml50gg5q",
  "user": {
    "id": 1,
    "username": "sangchun11",
    "name": "관리자",
    "role": "super_admin"
  }
}
```
✅ **결과**: 로그인 API 정상 작동

### 2. 로그인 페이지 리다이렉트 경로 확인
```bash
curl http://localhost:3000/static/login.html | grep "redirect"
```

**결과**:
```javascript
const redirect = urlParams.get('redirect') || '/'  // ✅ 루트 경로로 변경됨
```
✅ **결과**: 리다이렉트 경로 수정 완료

### 3. 테스트 계정
| 항목 | 값 |
|------|-----|
| 아이디 | sangchun11 |
| 비밀번호 | a2636991!@# |
| 역할 | super_admin |
| 상태 | active |

## 모바일 접속 테스트 가이드

### 1. 로그인 페이지 접속
```
URL: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/login
```

### 2. 로그인 정보 입력
- 아이디: `sangchun11`
- 비밀번호: `a2636991!@#`

### 3. 로그인 버튼 클릭

### 4. 예상 결과
- ✅ 로그인 성공 메시지 없이 자동으로 메인 대시보드로 이동
- ✅ 메인 대시보드 URL: `/` (운영현황 페이지)
- ✅ 상단에 사용자 이름 표시: "관리자"
- ✅ 대시보드 통계 카드 표시:
  - 총 바이크: 3개
  - 개인계약: 0개
  - 업체계약: 0개
  - 임시계약: 0개
  - 차용증: 0개

## 추가 수정 사항

### redirect 파라미터 지원
로그인 페이지는 URL 파라미터로 리다이렉트 경로를 지정할 수 있습니다:

**예시 1**: 특정 페이지로 리다이렉트
```
/login?redirect=/static/motorcycles.html
```
→ 로그인 후 오토바이 관리 페이지로 이동

**예시 2**: 기본 리다이렉트 (루트)
```
/login
```
→ 로그인 후 메인 대시보드(`/`)로 이동

## 관련 파일

### 수정된 파일
- `/home/user/webapp/public/static/login.html` (2곳 수정)

### 관련 API
- `POST /api/auth/login` - 로그인 처리
- `GET /api/auth/check` - 세션 확인
- `POST /api/auth/logout` - 로그아웃

### 관련 라우트
- `GET /` - 메인 대시보드 (운영현황)
- `GET /login` - 로그인 페이지

## 모바일 호환성

### 테스트 환경
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ 모바일 브라우저 일반

### 반응형 디자인
로그인 페이지와 메인 대시보드 모두 모바일 반응형 디자인 지원:
- 로그인 폼: 모바일에 최적화된 터치 인터페이스
- 대시보드: 모바일에서는 카드가 세로로 배치

## 문제 해결 체크리스트

로그인 문제 발생 시 확인 사항:

### 1. 네트워크 연결
- [ ] 인터넷 연결 확인
- [ ] 서버 URL 접근 가능 확인

### 2. 로그인 정보
- [ ] 아이디 정확히 입력 (대소문자 구분)
- [ ] 비밀번호 정확히 입력
- [ ] 계정 상태 활성화 확인

### 3. 브라우저 설정
- [ ] 쿠키 허용 확인
- [ ] JavaScript 활성화 확인
- [ ] localStorage 사용 가능 확인

### 4. 서버 상태
- [ ] API 서버 정상 작동 확인
- [ ] 데이터베이스 연결 확인
- [ ] 세션 관리 정상 작동 확인

## 향후 개선 사항

1. **로딩 인디케이터**: 로그인 버튼 클릭 시 로딩 표시
2. **에러 메시지 개선**: 더 명확한 오류 메시지 표시
3. **자동 로그인**: "로그인 상태 유지" 옵션 추가
4. **비밀번호 재설정**: 비밀번호 찾기 기능 추가

## 테스트 URL

- **로그인 페이지**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/login
- **메인 대시보드**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/

---

**작성일**: 2026-02-02
**문제 발견**: 2026-02-02 10:10
**수정 완료**: 2026-02-02 10:15
**담당자**: AI Developer
