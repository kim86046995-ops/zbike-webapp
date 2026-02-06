# 로그인 디버깅 가이드

## 🔍 브라우저에서 직접 확인하는 방법

### 1단계: 브라우저 개발자 도구 열기
- **Windows/Linux**: `F12` 또는 `Ctrl+Shift+I`
- **Mac**: `Cmd+Option+I`

### 2단계: Console 탭 열기
개발자 도구에서 **Console** 탭을 클릭하세요.

### 3단계: 로그인 페이지 접속
https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/login

**중요**: 반드시 **Shift + F5** (강력 새로고침)을 눌러 캐시를 무시하고 최신 버전을 로드하세요!

### 4단계: 로그인 시도
- 아이디: `sangchun11`
- 비밀번호: `a2636991!@#`

### 5단계: 콘솔 로그 확인

로그인 성공 시 다음과 같은 로그가 표시되어야 합니다:

```
=== 로그인 성공 ===
SessionID 저장: ux0m6e50cuml51uikd
User 저장: {"id":1,"username":"sangchun11","name":"관리자","role":"super_admin"}
==================
리다이렉트: /
```

### 6단계: 대시보드에서 확인

대시보드로 이동 후 콘솔에서 다음 로그를 확인하세요:

```
=== checkAuth 실행 ===
SessionID: ux0m6e50cuml51uikd
User: {id: 1, username: "sangchun11", name: "관리자", role: "super_admin"}
==================
✅ 로그인 상태 - UI 업데이트
```

## 🐛 문제 진단

### 케이스 1: localStorage가 비어있음
```
=== checkAuth 실행 ===
SessionID: null
User: {}
==================
❌ 비로그인 상태 - 로그인 버튼 표시
```

**원인**: localStorage에 세션 정보가 저장되지 않음
**해결**: 
1. 브라우저 쿠키/localStorage 설정 확인
2. 시크릿 모드에서 테스트
3. 다른 브라우저에서 테스트

### 케이스 2: 로그인 성공했지만 리다이렉트 안됨
```
=== 로그인 성공 ===
SessionID 저장: xxx
User 저장: {...}
==================
(리다이렉트 로그 없음)
```

**원인**: JavaScript 오류로 리다이렉트 실패
**해결**: 콘솔에서 오류 메시지 확인

### 케이스 3: 대시보드에서 checkAuth 실행 안됨
```
(아무 로그도 없음)
```

**원인**: checkAuth() 함수가 호출되지 않음
**해결**: 
1. 페이지 강력 새로고침 (Shift + F5)
2. 브라우저 캐시 완전 삭제
3. 시크릿 모드에서 테스트

## 💡 수동 테스트 방법

### localStorage 직접 확인
브라우저 콘솔에서 실행:

```javascript
// localStorage 내용 확인
console.log('SessionID:', localStorage.getItem('sessionId'))
console.log('User:', localStorage.getItem('user'))

// 수동으로 세션 저장 (테스트용)
localStorage.setItem('sessionId', 'test123')
localStorage.setItem('user', JSON.stringify({
  id: 1,
  username: 'sangchun11',
  name: '관리자',
  role: 'super_admin'
}))

// checkAuth 수동 실행
checkAuth()
```

### localStorage 삭제 (로그아웃 테스트)
```javascript
localStorage.removeItem('sessionId')
localStorage.removeItem('user')
location.reload()
```

## 🔧 브라우저 캐시 완전 삭제 방법

### Chrome/Edge:
1. `Ctrl+Shift+Delete` (Mac: `Cmd+Shift+Delete`)
2. "시간 범위": **전체 기간**
3. 체크: **캐시된 이미지 및 파일**, **쿠키 및 기타 사이트 데이터**
4. **데이터 삭제** 클릭

### Firefox:
1. `Ctrl+Shift+Delete` (Mac: `Cmd+Shift+Delete`)
2. "삭제할 기간": **전체**
3. 체크: **캐시**, **쿠키**
4. **지금 삭제** 클릭

### Safari:
1. `Cmd+Option+E` (캐시 비우기)
2. 환경설정 → 개인정보 보호 → 웹사이트 데이터 관리 → 모두 제거

## 📱 모바일 테스트

### Android Chrome:
1. 주소창에 `chrome://inspect` 입력
2. USB 디버깅 활성화
3. PC에서 Chrome DevTools로 원격 디버깅

### iOS Safari:
1. 설정 → Safari → 고급 → 웹 검사기 활성화
2. Mac Safari → 개발 메뉴 → 기기 선택
3. Safari DevTools로 디버깅

## 🚀 테스트 URL

### 대시보드:
https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/

### 로그인 (캐시 무효화):
https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/login?t=1234567890

**Tip**: URL 끝에 `?t=현재시간`을 추가하면 캐시를 무시합니다.

## 📞 추가 지원

위의 방법으로도 해결되지 않으면, 다음 정보를 제공해주세요:

1. **브라우저 콘솔 로그** (스크린샷)
2. **Network 탭에서 `/api/auth/login` 요청/응답** (스크린샷)
3. **Application 탭에서 localStorage 내용** (스크린샷)
4. **사용 중인 브라우저 및 버전**
5. **운영체제**

이 정보가 있으면 정확한 원인을 파악할 수 있습니다!
