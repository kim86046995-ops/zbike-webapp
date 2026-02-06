# 대시보드 로그인/로그아웃 UI 추가

## 개요
메인 대시보드 우측 상단에 로그인 상태 표시 및 로그인/로그아웃 버튼을 추가했습니다.

## 구현 내용

### 1. UI 구조

#### 헤더 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│ 운영현황 │ 운영현황 오토바이관리 계약서관리 차용증관리 설정 │ 홍길동 [로그아웃] │
└─────────────────────────────────────────────────────────────┘
```

#### HTML 구조
```html
<div class="flex items-center space-x-6">
    <nav class="flex space-x-4">
        <!-- 네비게이션 메뉴 -->
    </nav>
    
    <!-- 로그인/로그아웃 섹션 -->
    <div class="flex items-center space-x-3 border-l pl-6">
        <!-- 사용자 정보 (로그인 시 표시) -->
        <div id="userInfo" class="hidden">
            <span id="userName" class="text-gray-700 font-medium"></span>
        </div>
        
        <!-- 로그아웃 버튼 (로그인 시 표시) -->
        <button id="logoutBtn" onclick="handleLogout()" 
                class="hidden bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
        </button>
        
        <!-- 로그인 버튼 (비로그인 시 표시) -->
        <a id="loginBtn" href="/login" 
           class="hidden bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
            <i class="fas fa-sign-in-alt mr-2"></i>로그인
        </a>
    </div>
</div>
```

### 2. JavaScript 함수

#### checkAuth() - 로그인 상태 확인
```javascript
async function checkAuth() {
    const sessionId = localStorage.getItem('sessionId');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (sessionId && user.name) {
        // 로그인 상태
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('userName').textContent = user.name;
    } else {
        // 비로그인 상태
        document.getElementById('userInfo').classList.add('hidden');
        document.getElementById('logoutBtn').classList.add('hidden');
        document.getElementById('loginBtn').classList.remove('hidden');
    }
}
```

**동작 방식**:
1. localStorage에서 sessionId와 user 정보 확인
2. 로그인 상태이면:
   - 사용자 이름 표시
   - 로그아웃 버튼 표시
   - 로그인 버튼 숨김
3. 비로그인 상태이면:
   - 사용자 이름 숨김
   - 로그아웃 버튼 숨김
   - 로그인 버튼 표시

#### handleLogout() - 로그아웃 처리
```javascript
async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) {
        return;
    }
    
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
        try {
            await axios.post('/api/auth/logout', {}, {
                headers: { 'X-Session-ID': sessionId }
            });
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    }
    
    localStorage.removeItem('sessionId');
    localStorage.removeItem('user');
    window.location.href = '/login';
}
```

**동작 방식**:
1. 로그아웃 확인 다이얼로그 표시
2. 사용자 확인 시:
   - 서버에 로그아웃 API 호출 (`POST /api/auth/logout`)
   - localStorage에서 sessionId와 user 제거
   - 로그인 페이지로 리다이렉트

### 3. 페이지 로드 시 자동 실행

```javascript
// 페이지 로드 시 인증 확인 및 통계 로드
checkAuth();
loadStats();
```

**실행 순서**:
1. 페이지 로드
2. `checkAuth()` 실행 → 로그인 상태 UI 업데이트
3. `loadStats()` 실행 → 대시보드 통계 로드

## UI 상태별 표시

### 로그인 전 (비로그인 상태)
```
헤더 우측: [ 로그인 ]
```
- 사용자 이름: 숨김
- 로그아웃 버튼: 숨김
- 로그인 버튼: 표시 (파란색)

### 로그인 후
```
헤더 우측: 관리자 [ 로그아웃 ]
```
- 사용자 이름: 표시 (회색)
- 로그아웃 버튼: 표시 (빨간색)
- 로그인 버튼: 숨김

## 사용자 플로우

### 로그인 플로우
```
1. 비로그인 상태에서 대시보드 접속
   ↓
2. 헤더 우측에 [로그인] 버튼 표시
   ↓
3. [로그인] 버튼 클릭
   ↓
4. 로그인 페이지로 이동 (/login)
   ↓
5. 로그인 성공
   ↓
6. 대시보드로 리다이렉트 (/)
   ↓
7. 헤더 우측에 "사용자이름 [로그아웃]" 표시
```

### 로그아웃 플로우
```
1. 로그인 상태에서 대시보드 사용
   ↓
2. 헤더 우측 [로그아웃] 버튼 클릭
   ↓
3. "로그아웃 하시겠습니까?" 확인 다이얼로그
   ↓
4. [확인] 클릭
   ↓
5. 서버에 로그아웃 API 호출
   ↓
6. localStorage 세션 정보 삭제
   ↓
7. 로그인 페이지로 리다이렉트 (/login)
```

## 디자인 스펙

### 버튼 스타일

#### 로그인 버튼 (파란색)
- 배경색: `bg-blue-500`
- 호버: `hover:bg-blue-600`
- 텍스트: 흰색
- 아이콘: `fa-sign-in-alt`

#### 로그아웃 버튼 (빨간색)
- 배경색: `bg-red-500`
- 호버: `hover:bg-red-600`
- 텍스트: 흰색
- 아이콘: `fa-sign-out-alt`

#### 사용자 이름
- 텍스트 색상: `text-gray-700`
- 폰트: `font-medium`

### 레이아웃
- 네비게이션과 로그인 섹션 사이: `space-x-6`
- 경계선: `border-l`
- 패딩: `pl-6`
- 로그인 요소 간격: `space-x-3`

## API 연동

### POST /api/auth/logout
**요청**:
```javascript
axios.post('/api/auth/logout', {}, {
    headers: { 'X-Session-ID': sessionId }
})
```

**응답**:
```json
{
    "success": true
}
```

## localStorage 사용

### 저장되는 데이터

#### sessionId
```javascript
localStorage.setItem('sessionId', 'wtev0uic83ml50gg5q');
```

#### user
```javascript
localStorage.setItem('user', JSON.stringify({
    id: 1,
    username: 'sangchun11',
    name: '관리자',
    role: 'super_admin'
}));
```

### 읽기
```javascript
const sessionId = localStorage.getItem('sessionId');
const user = JSON.parse(localStorage.getItem('user') || '{}');
```

### 삭제
```javascript
localStorage.removeItem('sessionId');
localStorage.removeItem('user');
```

## 반응형 디자인

### 모바일 (작은 화면)
- 네비게이션과 로그인 섹션이 세로로 배치될 수 있음
- 버튼 크기 및 간격 조정

### 데스크톱 (큰 화면)
- 네비게이션과 로그인 섹션이 가로로 배치
- 최적의 간격과 크기 유지

## 테스트 시나리오

### 1. 비로그인 상태 테스트
1. localStorage 세션 정보 삭제
2. 대시보드 접속 (/)
3. 헤더 우측에 [로그인] 버튼 확인
4. [로그인] 버튼 클릭 → 로그인 페이지 이동 확인

### 2. 로그인 상태 테스트
1. 로그인 페이지에서 로그인
2. 대시보드로 자동 이동
3. 헤더 우측에 "관리자 [로그아웃]" 표시 확인

### 3. 로그아웃 테스트
1. 로그인 상태에서 [로그아웃] 버튼 클릭
2. 확인 다이얼로그 표시 확인
3. [확인] 클릭
4. 로그인 페이지로 이동 확인
5. localStorage 세션 정보 삭제 확인

### 4. 페이지 새로고침 테스트
1. 로그인 상태에서 페이지 새로고침 (F5)
2. 로그인 상태 유지 확인
3. 사용자 이름 및 로그아웃 버튼 정상 표시 확인

## 파일 변경 내역

### src/index.tsx

**변경 내용**:
1. 헤더 HTML 구조 수정 (로그인/로그아웃 UI 추가)
2. `checkAuth()` 함수 추가
3. `handleLogout()` 함수 추가
4. 페이지 로드 시 `checkAuth()` 호출 추가

**라인 수 변경**: +40줄

## 향후 개선 사항

1. **사용자 프로필**: 사용자 이름 클릭 시 프로필 모달 표시
2. **역할 표시**: 사용자 역할(super_admin, admin) 표시
3. **알림 기능**: 헤더에 알림 아이콘 추가
4. **자동 로그아웃**: 일정 시간 비활성 시 자동 로그아웃
5. **토스트 알림**: 로그아웃 성공 시 토스트 메시지 표시

## 테스트 URL

- **메인 대시보드**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/
- **로그인 페이지**: https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/login

## 테스트 계정

| 항목 | 값 |
|------|-----|
| 아이디 | sangchun11 |
| 비밀번호 | a2636991!@# |
| 역할 | super_admin |
| 이름 | 관리자 |

---

**작성일**: 2026-02-02
**마지막 업데이트**: 2026-02-02 10:30
**담당자**: AI Developer
