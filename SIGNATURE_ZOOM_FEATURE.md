# 계약서 서명 확대 기능

## 구현 완료

### 📱 주요 기능
계약서 서명 시 서명 영역을 터치하면 전체 화면으로 확대되어 더 편하게 서명할 수 있습니다.

### ✨ 구현 내용

#### 1. 서명 영역 클릭/터치 시 모달 열기
- **위치**: `/static/contract-sign` (계약서 서명 페이지)
- **동작**: 서명 캔버스 클릭 시 전체 화면 모달 오픈
- **안내**: "터치하면 확대됩니다" 메시지 추가

#### 2. 전체 화면 서명 모달
**모달 구성**:
- 전체 화면 (모바일) / 90% 화면 (데스크톱)
- 큰 서명 캔버스 (터치 최적화)
- 지우기 버튼 (빨간색)
- 서명 완료 버튼 (초록색)
- 닫기 버튼 (X)

#### 3. 서명 동기화
**기능**:
- 메인 캔버스 → 모달 캔버스 복사 (모달 열 때)
- 모달 캔버스 → 메인 캔버스 복사 (완료 버튼 클릭)
- 실시간 그리기 지원 (마우스 + 터치)

### 🎨 UI/UX 개선사항

#### Before
```
서명 영역: 800x200px (고정)
- 작은 화면에서 서명하기 어려움
- 특히 모바일에서 불편
```

#### After
```
서명 영역: 800x200px (기본)
클릭 시: 전체 화면으로 확대
- 모바일: 100% 화면
- 데스크톱: 90% 화면
- 편하게 큰 글씨로 서명 가능
```

### 📝 코드 변경사항

#### 1. HTML 수정 (`contract-sign.html`)
```html
<!-- 서명 캔버스에 클릭 이벤트 추가 -->
<div class="border-2 border-gray-400 rounded overflow-hidden bg-white" 
     onclick="openSignatureModal()" 
     style="cursor: pointer;">
    <canvas id="signatureCanvas" width="800" height="200" 
            class="w-full cursor-crosshair bg-white"></canvas>
</div>

<!-- 전체 화면 서명 모달 -->
<div id="signatureModal" class="fixed inset-0 bg-black bg-opacity-90 hidden z-50">
    <div class="bg-white w-full h-full md:w-11/12 md:h-5/6">
        <!-- 모달 헤더 -->
        <div class="bg-indigo-600 px-6 py-4">
            <h2 class="text-xl font-bold text-white">서명하기</h2>
            <button onclick="closeSignatureModal()">닫기</button>
        </div>
        
        <!-- 큰 서명 캔버스 -->
        <canvas id="signatureCanvasModal"></canvas>
        
        <!-- 버튼 -->
        <button onclick="clearModalSignature()">지우기</button>
        <button onclick="saveModalSignature()">서명 완료</button>
    </div>
</div>
```

#### 2. JavaScript 함수 추가
```javascript
// 모달 열기
function openSignatureModal() {
    // 모달 표시
    // 캔버스 크기 자동 조정
    // 기존 서명 복사
    // 터치/마우스 이벤트 등록
}

// 모달 닫기
function closeSignatureModal() {
    modal.classList.add('hidden');
}

// 모달 서명 지우기
function clearModalSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 서명 완료 (메인으로 복사)
function saveModalSignature() {
    // 모달 → 메인 캔버스 복사
    // 모달 닫기
}

// 모달 캔버스 초기화
function initModalSignaturePad() {
    // 터치 이벤트
    // 마우스 이벤트
    // 그리기 로직
}
```

### 🎯 사용자 경험

#### 모바일 사용자
1. 계약서 서명 페이지 접속
2. "아래 박스에 직접 서명해주세요 (터치하면 확대됩니다)" 안내 확인
3. 서명 영역 터치
4. **전체 화면 서명 모달 오픈** ⭐
5. 큰 화면에서 편하게 서명
6. [서명 완료] 버튼 클릭
7. 메인 화면으로 돌아가면 서명이 반영됨

#### 데스크톱 사용자
1. 서명 영역 클릭
2. 90% 크기의 큰 모달 오픈
3. 마우스로 서명
4. [서명 완료] 버튼 클릭

### 🧪 테스트 방법

#### 1. 계약서 생성 및 공유
```bash
# 로그인
아이디: sangchun11
비밀번호: a2636991!@#

# 계약서 작성
1. 대시보드 접속
2. "계약서 작성" 클릭
3. 계약서 정보 입력
4. 저장
5. 계약서 목록에서 "공유하기" 클릭
6. 공유 링크 복사
```

#### 2. 서명 테스트
```bash
# 공유 링크로 접속 (모바일 또는 데스크톱)
https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/contract-sign?token=xxx

# 서명 영역 터치/클릭
1. 서명 영역 클릭 → 모달 오픈 확인
2. 큰 캔버스에서 서명
3. [지우기] 버튼 테스트
4. [서명 완료] 클릭 → 메인 화면에 반영 확인
5. 모달 다시 열기 → 이전 서명 유지 확인
```

### 📱 반응형 디자인

#### 모바일 (< 768px)
- 모달: 100% 화면 (전체 화면)
- 캔버스: 100% 너비/높이
- 버튼: 큰 크기 (터치 최적화)

#### 태블릿/데스크톱 (≥ 768px)
- 모달: 90% 화면 (중앙 정렬)
- 라운드 모서리
- 마우스 최적화

### 🎨 스타일링

#### 모달 배경
```css
background: rgba(0, 0, 0, 0.9) /* 어두운 배경 */
z-index: 50 /* 최상위 */
```

#### 서명 캔버스
```css
border: 4px solid gray /* 두꺼운 테두리 */
background: white
cursor: crosshair /* 십자 커서 */
```

#### 버튼
```css
지우기: 빨간색 (bg-red-500)
완료: 초록색 (bg-green-500)
닫기: 흰색 아이콘
```

### 📊 기술 스택
- **HTML5 Canvas API**: 서명 그리기
- **Touch Events**: 모바일 터치 지원
- **Mouse Events**: 데스크톱 마우스 지원
- **Tailwind CSS**: 반응형 디자인

### 🔧 주요 함수

| 함수 | 설명 |
|------|------|
| `openSignatureModal()` | 모달 열기 + 캔버스 크기 조정 + 기존 서명 복사 |
| `closeSignatureModal()` | 모달 닫기 |
| `clearModalSignature()` | 모달 캔버스 지우기 |
| `saveModalSignature()` | 모달 서명을 메인으로 복사 + 모달 닫기 |
| `initModalSignaturePad()` | 모달 캔버스 이벤트 리스너 등록 |

### ✅ 테스트 체크리스트

- [ ] 서명 영역 클릭 시 모달 오픈
- [ ] 모달에서 마우스로 그리기
- [ ] 모달에서 터치로 그리기
- [ ] [지우기] 버튼 동작
- [ ] [서명 완료] 시 메인에 반영
- [ ] [X] 버튼으로 모달 닫기
- [ ] 모달 재오픈 시 이전 서명 유지
- [ ] 모바일 화면에서 전체 화면 표시
- [ ] 데스크톱 화면에서 90% 크기 표시

### 🎉 결과

이제 계약서 서명이 **훨씬 편리**합니다!
- 작은 서명 영역 → **큰 전체 화면**
- 손가락으로 편하게 서명 가능
- 언제든지 확대/축소 전환 가능

---

## 테스트 URL

**대시보드**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/

**계약서 목록**: https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/contracts.html

**테스트 계정**:
- 아이디: `sangchun11`
- 비밀번호: `a2636991!@#`

---

**구현 완료일**: 2026-02-02
**파일**: `/home/user/webapp/public/static/contract-sign.html`
