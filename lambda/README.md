# AWS Lambda SMS 중계 서버

알리고 SMS를 AWS Lambda를 통해 중계하는 서버리스 함수입니다.

## 📋 설정 정보

- **고정 IP**: 13.209.230.136 (NAT Gateway)
- **발신번호**: 0624006991 (지바이크 대표번호)
- **API Key**: pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9

## 🚀 배포 방법

### 방법 1: 자동 배포 스크립트 (권장)

```bash
cd lambda
./deploy-lambda.sh
```

### 방법 2: AWS 콘솔에서 수동 배포

1. **AWS Lambda 콘솔** 접속
2. **함수 생성** 클릭
   - 함수 이름: `zbike-sms-relay`
   - 런타임: Node.js 20.x
3. **코드 업로드**
   - `index.mjs` 내용 복사/붙여넣기
4. **환경변수 설정**
   - `ALIGO_API_KEY` = `pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9`
   - `ALIGO_USER_ID` = `pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9`
   - `ALIGO_SENDER` = `0624006991` (지바이크 대표번호)
5. **타임아웃 설정**
   - 30초로 변경
6. **Function URL 생성**
   - 인증 유형: NONE
   - CORS: 활성화

## 🔧 Cloudflare Workers 연동

### 1. Function URL 복사

Lambda 배포 후 Function URL을 복사합니다.
예: `https://abc123.lambda-url.ap-northeast-2.on.aws/`

### 2. 로컬 개발 환경 설정

`.dev.vars` 파일 수정:

```bash
SMS_AWS_LAMBDA_URL=https://your-function-url.lambda-url.ap-northeast-2.on.aws/
SMS_ENABLED=false  # 테스트 시 true로 변경
SMS_TEST_MODE=true # 실제 발송 시 false로 변경
ADMIN_PHONE=0624006991
```

### 3. 프로덕션 환경 설정

Cloudflare Secrets 등록:

```bash
# Function URL 등록
npx wrangler pages secret put SMS_AWS_LAMBDA_URL --project-name zbike-webapp
# 값 입력: https://your-function-url.lambda-url.ap-northeast-2.on.aws/

# SMS 활성화
npx wrangler pages secret put SMS_ENABLED --project-name zbike-webapp
# 값 입력: true

# 테스트 모드 설정
npx wrangler pages secret put SMS_TEST_MODE --project-name zbike-webapp
# 값 입력: false (실제 발송) 또는 true (테스트)

# 관리자 전화번호
npx wrangler pages secret put ADMIN_PHONE --project-name zbike-webapp
# 값 입력: 0624006991
```

## 🧪 테스트

### 잔액 조회 테스트

```bash
curl -X POST https://your-function-url.lambda-url.ap-northeast-2.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{"action":"balance"}'
```

예상 응답:
```json
{
  "success": true,
  "balance": 1000,
  "message": "success"
}
```

### SMS 발송 테스트

```bash
curl -X POST https://your-function-url.lambda-url.ap-northeast-2.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "01012345678",
    "message": "테스트 메시지입니다"
  }'
```

예상 응답:
```json
{
  "success": true,
  "message": "success",
  "code": "1",
  "messageId": "123456789"
}
```

## 📁 파일 구조

```
lambda/
├── index.mjs              # Lambda 함수 코드
├── package.json           # 패키지 정보
├── deploy-lambda.sh       # 자동 배포 스크립트
└── README.md             # 이 파일
```

## 🛡️ 보안

- Lambda 함수는 VPC 내 Private Subnet에 배치
- NAT Gateway를 통해 고정 IP로 외부 통신
- 알리고 API는 고정 IP만 허용
- 환경변수로 API Key 관리

## 💰 비용

### Lambda
- 월 100만 건 무료 (SMS 1건 = Lambda 호출 1회)
- **예상 비용: 거의 무료**

### NAT Gateway
- 시간당 $0.059 (~월 $45)
- 데이터 처리: GB당 $0.059
- **예상 비용: 월 $50**

## 🔍 로그 확인

AWS CloudWatch Logs에서 확인:
- 로그 그룹: `/aws/lambda/zbike-sms-relay`

## ⚠️ 주의사항

1. **환경변수 절대 노출 금지**
   - GitHub에 커밋하지 마세요
   - `.gitignore`에 `.dev.vars` 추가 필수

2. **NAT Gateway 비용**
   - 월 $50 정도 발생
   - 대안: Lambda IP 범위 전체를 알리고에 등록 (무료, 보안 낮음)

3. **알리고 잔액 확인**
   - 정기적으로 SMS 잔액 확인 필요

## 🆘 문제 해결

### Lambda 함수가 응답하지 않음
- CloudWatch Logs 확인
- 타임아웃 설정 확인 (30초)
- VPC 설정 확인 (NAT Gateway)

### SMS 발송 실패
- 알리고 잔액 확인
- 발신번호 등록 확인
- 고정 IP 등록 확인 (13.209.230.136)

### CORS 오류
- Function URL CORS 설정 확인
- Lambda 응답 헤더 확인

## 📞 지원

문제가 발생하면:
1. CloudWatch Logs 확인
2. 알리고 관리자 페이지 확인
3. AWS Lambda 콘솔에서 테스트

---

**마지막 업데이트**: 2025-02-27
