# 뒤로가기 버튼 수정 및 계약자 정보 보드 추가

## 🔧 수정 사항

### 1. 뒤로가기 버튼 경로 수정 ✅

**문제**: `/dashboard` 경로가 존재하지 않음  
**해결**: 모든 뒤로가기 버튼을 `/` (메인 대시보드) 경로로 수정

**수정된 페이지**:
- `motorcycles.html` - `/dashboard` → `/`
- `contracts.html` - `/dashboard` → `/`
- `contract-new.html` - `/dashboard` → `/`

---

### 2. 메인 대시보드에 계약자 정보 보드 추가 ✅

**위치**: 추가 통계 카드와 빠른 액세스 사이에 배치

**기능**:
- ✅ 이름 입력
- ✅ 주민등록번호 입력 (자동 하이픈 추가)
- ✅ 전화번호 입력 (자동 하이픈 추가)
- ✅ 우편번호 검색 (Daum Postcode API)
- ✅ 주소 자동 입력
- ✅ 상세주소 입력
- ✅ 저장 기능
- ✅ 초기화 기능

---

## 📋 계약자 정보 보드 상세

### UI 구성

```
┌─────────────────────────────────────────┐
│ 👤 계약자 정보 등록                      │
├─────────────────────────────────────────┤
│ 이름 *         │ 주민등록번호 *          │
│ [        ]     │ [123456-1234567]       │
│                │                         │
│ 전화번호 *     │ 우편번호 *              │
│ [010-1234]     │ [12345] [검색 🔍]      │
│                │                         │
│ 주소 *                                   │
│ [서울시 강남구 테헤란로...]              │
│                                          │
│ 상세주소                                 │
│ [101동 1001호]                           │
│                                          │
│              [🔄 초기화] [💾 저장]      │
└─────────────────────────────────────────┘
```

### 입력 필드

#### 1. 이름
- **타입**: 텍스트
- **필수**: ✅
- **플레이스홀더**: "홍길동"

#### 2. 주민등록번호
- **타입**: 텍스트
- **필수**: ✅
- **최대 길이**: 14자
- **형식**: `123456-1234567`
- **자동 포맷팅**: 6자리 입력 후 자동으로 하이픈 추가

#### 3. 전화번호
- **타입**: 전화번호
- **필수**: ✅
- **최대 길이**: 13자
- **형식**: `010-1234-5678`
- **자동 포맷팅**: 3-4-4 형식으로 자동 하이픈 추가

#### 4. 우편번호
- **타입**: 텍스트
- **필수**: ✅
- **읽기 전용**: ✅
- **입력 방법**: [검색] 버튼 클릭
- **API**: Daum Postcode API

#### 5. 주소
- **타입**: 텍스트
- **필수**: ✅
- **읽기 전용**: ✅
- **자동 입력**: 우편번호 검색 시 자동으로 입력됨

#### 6. 상세주소
- **타입**: 텍스트
- **필수**: ❌
- **플레이스홀더**: "상세주소 (동/호수 등)"

---

## 🔍 우편번호 검색 기능

### Daum Postcode API 사용

```javascript
function searchAddress() {
    new daum.Postcode({
        oncomplete: function(data) {
            // 우편번호 입력
            document.getElementById('customerPostcode').value = data.zonecode;
            
            // 주소 입력 (도로명 또는 지번)
            let fullAddress = data.userSelectedType === 'R' 
                ? data.roadAddress 
                : data.jibunAddress;
            
            // 건물명 추가
            if (data.buildingName !== '') {
                fullAddress += ' (' + data.buildingName + ')';
            }
            
            document.getElementById('customerAddress').value = fullAddress;
            
            // 상세주소 필드에 포커스
            document.getElementById('customerDetailAddress').focus();
        }
    }).open();
}
```

### 검색 흐름
```
1. [검색] 버튼 클릭
   ↓
2. Daum 우편번호 팝업 표시
   ↓
3. 주소 검색 (도로명 또는 지번)
   ↓
4. 주소 선택
   ↓
5. 우편번호 & 주소 자동 입력
   ↓
6. 상세주소 입력 필드에 포커스
   ↓
7. 사용자가 상세주소 입력
```

---

## 💾 저장 기능

### API 엔드포인트
```
POST /api/customers
```

### 요청 헤더
```json
{
  "Content-Type": "application/json",
  "X-Session-ID": "세션ID"
}
```

### 요청 바디
```json
{
  "name": "홍길동",
  "resident_number": "123456-1234567",
  "phone": "010-1234-5678",
  "address": "서울시 강남구 테헤란로 123 (삼성동, 빌딩명) 101동 1001호",
  "license_type": "보통"
}
```

### 유효성 검사
- ✅ 이름 필수
- ✅ 주민등록번호 14자 (123456-1234567)
- ✅ 전화번호 필수
- ✅ 우편번호 필수

### 응답
```json
{
  "id": 1,
  "name": "홍길동",
  "resident_number": "123456-1234567",
  "phone": "010-1234-5678",
  "address": "서울시 강남구...",
  "license_type": "보통"
}
```

---

## 🎨 자동 포맷팅

### 주민등록번호
```javascript
// 입력: 1234561234567
// 결과: 123456-1234567

document.getElementById('customerResidentNumber').addEventListener('input', function(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 6) {
        value = value.substring(0, 6) + '-' + value.substring(6, 13);
    }
    e.target.value = value;
});
```

### 전화번호
```javascript
// 입력: 01012345678
// 결과: 010-1234-5678

document.getElementById('customerPhone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 3 && value.length <= 7) {
        value = value.substring(0, 3) + '-' + value.substring(3);
    } else if (value.length > 7) {
        value = value.substring(0, 3) + '-' + value.substring(3, 7) + '-' + value.substring(7, 11);
    }
    e.target.value = value;
});
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 계약자 정보 등록
```
1. 메인 대시보드 접속 (로그인 필요)
2. "계약자 정보 등록" 섹션으로 스크롤
3. 이름 입력: "김철수"
4. 주민등록번호 입력: "850101" → 자동으로 "850101-" 표시
5. 나머지 입력: "1234567"
6. 전화번호 입력: "010" → 자동으로 "010-" 표시
7. 나머지 입력: "12345678"
8. [검색] 버튼 클릭
9. 우편번호 팝업에서 주소 검색 및 선택
10. 상세주소 입력: "101동 1001호"
11. [저장] 버튼 클릭
12. 성공 메시지 확인 ✅
13. 폼 자동 초기화 ✅
```

### 시나리오 2: 유효성 검사
```
1. 이름만 입력하고 [저장] 클릭
   → "주민등록번호를 정확히 입력하세요" 경고 ✅

2. 주민등록번호 12자리만 입력
   → "주민등록번호를 정확히 입력하세요" 경고 ✅

3. 우편번호 검색 없이 저장
   → "우편번호를 검색하세요" 경고 ✅
```

### 시나리오 3: 초기화
```
1. 모든 필드에 데이터 입력
2. [초기화] 버튼 클릭
3. 모든 필드 초기화 확인 ✅
```

---

## 🔐 보안

### 인증 요구
- ✅ `authMiddleware` 적용
- ✅ 세션 ID 필수
- ✅ 미인증 시 로그인 페이지로 리디렉트

### 데이터 검증
- ✅ 서버 측 유효성 검사
- ✅ SQL 인젝션 방지 (Prepared Statement)
- ✅ XSS 방지

---

## 📁 수정된 파일

### 백엔드
- `/home/user/webapp/src/index.tsx`
  - 계약자 정보 보드 HTML 추가
  - 우편번호 검색 JavaScript 추가
  - 자동 포맷팅 로직 추가
  - 폼 제출 처리 추가
  - `POST /api/customers`에 `authMiddleware` 추가

### 프론트엔드
- `/home/user/webapp/public/static/motorcycles.html` - 뒤로가기 경로 수정
- `/home/user/webapp/public/static/contracts.html` - 뒤로가기 경로 수정
- `/home/user/webapp/public/static/contract-new.html` - 뒤로가기 경로 수정

---

## 🌐 테스트 URL

- **메인 대시보드** (계약자 정보 보드 포함): https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/
- **오토바이 관리** (뒤로가기 테스트): https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/motorcycles.html
- **계약서 목록** (뒤로가기 테스트): https://3000-ikdibnajukplmgra2ipiv-a402f90a.sandbox.novita.ai/static/contracts.html

**테스트 계정**: 아이디 `sangchun11` / 비밀번호 `a2636991!@#`

---

## ✅ 결과

### 1. 뒤로가기 버튼 수정
- ✅ `/dashboard` → `/` 경로 수정
- ✅ 모든 페이지에서 정상 작동
- ✅ 3개 페이지 수정 완료

### 2. 계약자 정보 보드
- ✅ 메인 대시보드에 추가
- ✅ 모든 필드 구현 (이름, 주민번호, 전화, 주소)
- ✅ 우편번호 검색 (Daum API)
- ✅ 자동 하이픈 추가 (주민번호, 전화번호)
- ✅ 유효성 검사
- ✅ 저장 기능
- ✅ 초기화 기능
- ✅ 로그인 인증 필요

**모든 기능이 정상 작동합니다!** 🚀

---

**구현 완료일**: 2026-02-02  
**수정 파일**: 4개 (index.tsx, motorcycles.html, contracts.html, contract-new.html)
