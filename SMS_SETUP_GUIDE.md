# 📱 알리고(Aligo) SMS 연동 가이드

## 🎯 개요

지바이크 웹앱에 알리고 SMS 기능이 추가되었습니다.
- ✅ **완전히 안전**: SMS 실패해도 계약서 저장에 영향 없음
- ✅ **선택적 기능**: 환경변수로 활성화/비활성화 제어
- ✅ **테스트 모드**: 실제 전송 전 안전하게 테스트 가능

---

## 📋 1단계: 알리고 API 정보 준비

### 필요한 정보
1. **API Key** (알리고 웹사이트에서 확인)
2. **사용자 ID** (알리고 계정 ID)
3. **발신번호** (예: 010-1234-5678)
4. **관리자 전화번호** (알림 받을 번호)

### 알리고 웹사이트
- URL: https://www.aligo.in
- 로그인 → [마이페이지] → [API 키 확인]

---

## 🔧 2단계: 환경변수 설정

### 로컬 개발 환경 (.dev.vars)
```bash
# SMS 기능 활성화 (처음에는 false로 시작)
SMS_ENABLED=false

# 테스트 모드 (true: 실제 전송 안 함, false: 실제 전송)
SMS_TEST_MODE=true

# 알리고 API 정보
SMS_API_KEY=your_aligo_api_key
SMS_USER_ID=your_aligo_user_id

# 발신번호 (하이픈 포함 가능)
SMS_SENDER_PHONE=010-1234-5678

# 관리자 번호 (계약 알림 수신)
ADMIN_PHONE=010-1234-5678
```

### 프로덕션 환경 (Cloudflare Secrets)
```bash
# 로컬에서 실행 (한 번만)
npx wrangler pages secret put SMS_API_KEY --project-name zbike-webapp
npx wrangler pages secret put SMS_USER_ID --project-name zbike-webapp
npx wrangler pages secret put SMS_SENDER_PHONE --project-name zbike-webapp
npx wrangler pages secret put ADMIN_PHONE --project-name zbike-webapp
```

---

## 🧪 3단계: 테스트

### 3-1. 로컬 테스트 (테스트 모드)
```bash
# .dev.vars 설정
SMS_ENABLED=true
SMS_TEST_MODE=true  # 실제 전송 안 함!

# 서버 재시작
npm run clean-port
npm run build
pm2 restart zbike-webapp

# 테스트 계약서 작성
# → 콘솔에 SMS 로그만 출력됨 (실제 전송 X)
```

### 3-2. SMS 상태 확인 API
```bash
# 슈퍼관리자로 로그인 후
GET https://zbike-webapp.pages.dev/api/sms/status

# 응답 예시
{
  "success": true,
  "config": {
    "enabled": true,
    "testMode": true,
    "senderPhone": "010-1234-5678",
    "adminPhone": "010-1234-5678",
    "apiKeyConfigured": true,
    "userIdConfigured": true
  }
}
```

### 3-3. SMS 잔액 조회
```bash
GET https://zbike-webapp.pages.dev/api/sms/balance

# 응답 예시
{
  "success": true,
  "balance": 1000,
  "message": "SMS 잔액: 1000건"
}
```

### 3-4. SMS 테스트 전송
```bash
POST https://zbike-webapp.pages.dev/api/sms/test
{
  "phone": "010-0000-0000",  # 본인 번호로 테스트
  "message": "테스트 메시지입니다"
}

# 응답 예시
{
  "success": true,
  "message": "전송 성공"
}
```

---

## 🚀 4단계: 프로덕션 배포

### 4-1. 테스트 모드로 배포
```bash
# wrangler.jsonc 수정
{
  "vars": {
    "SMS_ENABLED": "true",
    "SMS_TEST_MODE": "true"  # ← 테스트 모드
  }
}

# 배포
npm run deploy:prod
```

### 4-2. 본인 번호로 실제 테스트
```bash
# wrangler.jsonc 수정
{
  "vars": {
    "SMS_ENABLED": "true",
    "SMS_TEST_MODE": "false"  # ← 실제 전송!
  }
}

# Secret에 본인 번호만 설정
npx wrangler pages secret put ADMIN_PHONE --project-name zbike-webapp
# → 본인 번호 입력

# 배포 후 테스트 계약서 작성
# → 본인 번호로만 SMS 전송됨
```

### 4-3. 전체 활성화
```bash
# 충분히 테스트 후
# Secret에 실제 관리자 번호 설정
npx wrangler pages secret put ADMIN_PHONE --project-name zbike-webapp

# 배포
npm run deploy:prod
```

---

## 📱 SMS 전송 시점

### 1. 계약 생성 시
- **고객**: 계약 완료 알림
- **관리자**: 신규 계약 알림

### 2. 계약 해지 시
- **고객**: 계약 해지 알림
- **관리자**: 해지 알림

---

## 🛡️ 안전장치

### 1. SMS 실패해도 계약서는 저장됨
```typescript
try {
  // 계약서 저장 (필수)
  await DB.prepare('INSERT INTO contracts ...').run() ✅
  
  // SMS 전송 (부가)
  sendSMS(...).catch(ignore) // 실패해도 무시 ⚠️
} catch (error) {
  // 오직 계약서 저장 실패만 에러 처리
}
```

### 2. 환경변수로 즉시 비활성화 가능
```bash
# 문제 발생 시 즉시 비활성화
SMS_ENABLED=false

# 재배포
npm run deploy:prod
```

### 3. Try-Catch로 완벽 격리
```typescript
try {
  await sendSMS(...)
} catch (smsError) {
  console.error('SMS 실패 (무시)')
  // 계약서 저장에는 영향 없음!
}
```

---

## 🔄 발신번호 교체

나중에 발신번호를 변경하려면:

```bash
# Secret 업데이트
npx wrangler pages secret put SMS_SENDER_PHONE --project-name zbike-webapp
# → 새 번호 입력

# 재배포 (코드 변경 없음!)
npm run deploy:prod
```

---

## 📊 SMS 메시지 템플릿

### 계약 생성
```
[지바이크] {고객명}님, 계약이 완료되었습니다.
계약번호: {계약번호}
차량: {번호판}
감사합니다.
```

### 계약 해지
```
[지바이크] {고객명}님, 계약이 해지되었습니다.
차량: {번호판}
이용해 주셔서 감사합니다.
```

### 관리자 알림
```
[지바이크 관리자] 신규 계약
고객: {고객명}
차량: {번호판}
유형: {리스/렌트}
```

---

## ⚠️ 주의사항

1. **절대 .dev.vars 파일을 GitHub에 커밋하지 마세요!**
2. **처음에는 반드시 SMS_TEST_MODE=true로 테스트**
3. **본인 번호로 먼저 실제 전송 테스트**
4. **알리고 잔액을 주기적으로 확인**

---

## 🆘 문제 해결

### SMS가 전송되지 않아요
```bash
# 1. 설정 확인
GET /api/sms/status

# 2. 잔액 확인
GET /api/sms/balance

# 3. 테스트 전송
POST /api/sms/test
{
  "phone": "010-0000-0000",
  "message": "테스트"
}
```

### 계약서 저장이 안 돼요
- SMS 기능과 무관합니다!
- SMS를 비활성화해도 계약서는 정상 저장됩니다
- SMS 코드는 완전히 격리되어 있습니다

---

## 📝 다음 단계

지금 알리고 API 정보를 알려주시면:
1. `.dev.vars` 파일에 정보 입력
2. 로컬에서 테스트
3. 프로덕션 Secret 설정
4. 배포

**필요한 정보를 알려주시면 바로 설정해드리겠습니다!** 🚀
