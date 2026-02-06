# 로그인 문제 해결 - iframe localStorage 이슈

## 문제 상황
로그인 후에도 대시보드에서 **파란색 로그인 버튼**이 그대로 표시되고, 로그인 상태가 유지되지 않는 문제가 발생했습니다.

### 스크린샷 분석:
- ✅ 로그인 성공적으로 완료
- ❌ 대시보드 헤더에 여전히 "로그인" 버튼 표시
- ❌ 사용자 이름 및 역할 배지 미표시
- ❌ 로그인 상태 유지 실패

## 원인 분석

### 1. iframe 구조 문제
```typescript
// 기존 코드 (문제)
app.get('/login', (c) => {
  return c.html(`
    <iframe src="/static/login" class="w-full h-screen"></iframe>
  `)
})
```

### 2. localStorage 격리
- **iframe 내부**: `/static/login` 페이지에서 localStorage에 세션 저장
- **부모 페이지**: `/` 대시보드에서 localStorage 읽기 시도
- **결과**: iframe과 부모 페이지의 localStorage가 **완전히 분리**되어 있어서 세션 정보를 공유할 수 없음

### 3. 동일 출처 정책 (Same-Origin Policy)
브라우저의 보안 정책으로 인해, iframe 내부의 localStorage와 부모 창의 localStorage는 **별도의 저장소**로 관리됩니다.

```
/login (부모)
  └─ iframe: /static/login (자식)
     └─ localStorage.setItem('sessionId', ...) // ❌ 부모에서 접근 불가!
```

## 해결 방법

### 옵션 1: 리다이렉트 방식 (채택됨) ✅
```typescript
app.get('/login', (c) => {
  // iframe 제거, 직접 리다이렉트
  return c.redirect('/static/login')
})
```

**장점:**
- 간단하고 명확
- localStorage 공유 문제 완전 해결
- 추가 코드 불필요

**동작 흐름:**
1. 사용자가 `/login` 접속
2. 자동으로 `/static/login`으로 리다이렉트
3. 로그인 성공 → localStorage에 세션 저장
4. `/` 대시보드로 이동
5. checkAuth()가 localStorage에서 세션 읽기 ✅
6. 사용자 정보 및 로그아웃 버튼 표시 ✅

### 옵션 2: postMessage API (대안)
iframe을 유지하면서 postMessage로 통신하는 방법도 있지만, 복잡도가 높아서 채택하지 않았습니다.

## 코드 변경 사항

### src/index.tsx
```typescript
// 변경 전
app.get('/login', (c) => {
  const version = Date.now()
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>관리자 로그인</title>
</head>
<body style="margin: 0; padding: 0; overflow: hidden;">
<iframe src="/static/login?v=${version}" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 변경 후
app.get('/login', (c) => {
  return c.redirect('/static/login')
})
```

### serveStatic root 경로
```typescript
// 변경 전
app.use('/static/*', serveStatic({ root: './public' }))

// 변경 후
app.use('/static/*', serveStatic({ root: './' }))
```

## 테스트 결과

### 테스트 시나리오:
1. ✅ `/login` 접속 → `/static/login`으로 자동 리다이렉트
2. ✅ 로그인 성공 → localStorage에 sessionId 및 user 정보 저장
3. ✅ 대시보드(`/`)로 이동
4. ✅ checkAuth() 함수가 localStorage 읽기 성공
5. ✅ 사용자 이름 및 역할 배지 표시
6. ✅ 로그인 버튼 숨김, 로그아웃 버튼 표시

### 테스트 계정:
1. **슈퍼관리자**: `sangchun11` / `a2636991!@#`
2. **일반 관리자**: `testadmin` / `test123`

### API 테스트:
```bash
# 로그인 API
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"sangchun11","password":"a2636991!@#"}'

# 응답
{
  "success": true,
  "sessionId": "v0e16l1rleml51h0wu",
  "user": {
    "id": 1,
    "username": "sangchun11",
    "name": "관리자",
    "role": "super_admin"
  }
}
```

## 추가 수정 사항

### 1. 로그인 버튼 초기 상태
```typescript
// 비로그인 시 로그인 버튼을 보이도록 설정
<a id="loginBtn" href="/login" 
   class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition inline-block">
    <i class="fas fa-sign-in-alt mr-2"></i>로그인
</a>
```

### 2. checkAuth() 자동 실행
```javascript
// 페이지 로드 시 자동 실행
checkAuth();
loadStats();
```

## 빌드 및 배포

### 빌드 명령:
```bash
cd /home/user/webapp
npm run build
cp -r public/* dist/
pm2 restart webapp
```

### 배포 확인:
```bash
# 리다이렉트 확인
curl -I http://localhost:3000/login

# 응답
HTTP/1.1 302 Found
Location: /static/login
```

## 테스트 URL

### 대시보드:
https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/

### 로그인:
https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/login
(자동으로 `/static/login`으로 리다이렉트)

## 결론

iframe을 제거하고 직접 리다이렉트 방식으로 변경하여 **localStorage 공유 문제를 완전히 해결**했습니다. 이제 로그인 후 세션 정보가 정상적으로 유지되며, 대시보드에서 사용자 정보가 올바르게 표시됩니다.

### 해결된 문제:
✅ 로그인 후 세션 유지
✅ 사용자 이름 및 역할 배지 표시
✅ 로그인/로그아웃 버튼 상태 전환
✅ 슈퍼관리자 관리 패널 접근

### 관련 문서:
- `/home/user/webapp/ADMIN_MANAGEMENT_FEATURE.md` - 관리자 관리 기능
- `/home/user/webapp/DASHBOARD_LOGIN_LOGOUT_UI.md` - 로그인/로그아웃 UI
