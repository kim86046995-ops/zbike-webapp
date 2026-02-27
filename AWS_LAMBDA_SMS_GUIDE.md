# AWS Lambda를 통한 알리고 SMS 전송

## 아키텍처
```
Cloudflare Workers → AWS API Gateway/Lambda URL → AWS Lambda (NAT Gateway) → Aligo API
```

알리고는 고정 IP 화이트리스트를 사용하므로 AWS Lambda를 중계 서버로 사용합니다.

---

## 1단계: AWS Lambda 함수 생성

### Lambda 함수 코드 (Node.js 20.x)

파일명: `index.mjs`

```javascript
import https from 'https';
import querystring from 'querystring';

/**
 * 알리고 SMS 전송 Lambda 함수
 * 
 * 환경변수:
 * - ALIGO_API_KEY: 알리고 API Key
 * - ALIGO_USER_ID: 알리고 사용자 ID
 * - ALIGO_SENDER: 발신 전화번호
 */

export const handler = async (event) => {
  console.log('📱 SMS 전송 요청:', JSON.stringify(event, null, 2));
  
  try {
    // 요청 파싱
    let body;
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      body = event;
    }
    
    const { phone, message, action = 'send' } = body;
    
    // 환경변수 확인
    const API_KEY = process.env.ALIGO_API_KEY;
    const USER_ID = process.env.ALIGO_USER_ID;
    const SENDER = process.env.ALIGO_SENDER;
    
    if (!API_KEY || !USER_ID || !SENDER) {
      throw new Error('알리고 환경변수가 설정되지 않았습니다');
    }
    
    // 잔액 조회
    if (action === 'balance') {
      const balanceResult = await callAligoAPI('/remain/', {
        key: API_KEY,
        user_id: USER_ID
      });
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: balanceResult.result_code === '1',
          balance: parseInt(balanceResult.SMS_CNT || '0'),
          message: balanceResult.message
        })
      };
    }
    
    // SMS 전송
    if (!phone || !message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: '전화번호와 메시지를 입력하세요'
        })
      };
    }
    
    // 전화번호 정규화
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const normalizedSender = SENDER.replace(/[^0-9]/g, '');
    
    // 알리고 API 호출
    const result = await callAligoAPI('/send/', {
      key: API_KEY,
      user_id: USER_ID,
      sender: normalizedSender,
      receiver: normalizedPhone,
      msg: message,
      msg_type: message.length > 90 ? 'LMS' : 'SMS',
      title: message.length > 90 ? '지바이크 알림' : ''
    });
    
    console.log('📱 알리고 응답:', result);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: result.result_code === '1',
        message: result.message,
        code: result.result_code,
        messageId: result.msg_id
      })
    };
    
  } catch (error) {
    console.error('❌ SMS 전송 오류:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

/**
 * 알리고 API 호출
 */
function callAligoAPI(path, params) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(params);
    
    const options = {
      hostname: 'apis.aligo.in',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('알리고 응답 파싱 실패: ' + data));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}
```

---

## 2단계: AWS Lambda 배포

### 방법 A: AWS 콘솔에서 직접 생성

1. **AWS Lambda 콘솔** 접속
2. **함수 생성** 클릭
   - 함수 이름: `zbike-sms-relay`
   - 런타임: Node.js 20.x
   - 아키텍처: x86_64
3. **코드 업로드**
   - 위의 `index.mjs` 코드 복사/붙여넣기
4. **환경변수 설정**
   - `ALIGO_API_KEY` = `pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9`
   - `ALIGO_USER_ID` = `pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9` (동일)
   - `ALIGO_SENDER` = `01086046995`
5. **타임아웃 설정**
   - 30초로 변경 (기본 3초는 부족)

### 방법 B: AWS CLI로 배포

```bash
# 1. 함수 생성
aws lambda create-function \
  --function-name zbike-sms-relay \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --environment Variables="{ALIGO_API_KEY=pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9,ALIGO_USER_ID=pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9,ALIGO_SENDER=01086046995}"
```

---

## 3단계: NAT Gateway 설정 (고정 IP)

### ✅ 이미 설정된 고정 IP: `13.209.230.136`

### Lambda를 VPC에 배치하고 NAT Gateway 사용

1. **VPC 생성** (이미 있으면 생략)
2. **NAT Gateway 생성**
   - Elastic IP 할당: **13.209.230.136** (이미 할당됨)
   - Public Subnet에 배치
3. **Lambda VPC 설정**
   - Private Subnet에 Lambda 배치
   - NAT Gateway를 통해 외부 통신
4. **알리고에 고정 IP 등록**
   - NAT Gateway의 Elastic IP를 알리고에 등록: **13.209.230.136** ✅ 완료

---

## 4단계: API Gateway 또는 Function URL 설정

### 옵션 A: Lambda Function URL (더 간단)

1. Lambda 함수 → **구성** → **함수 URL**
2. **함수 URL 생성** 클릭
   - 인증 유형: NONE (또는 AWS_IAM)
   - CORS 설정: 활성화
3. URL 복사 (예: `https://abc123.lambda-url.ap-northeast-2.on.aws/`)

### 옵션 B: API Gateway (더 안전)

1. **API Gateway 콘솔** 접속
2. **REST API 생성**
3. **리소스 생성**: `/sms`
4. **메서드 생성**: POST
5. **Lambda 통합** 설정
6. **API 배포**: `prod` 스테이지
7. URL 복사

---

## 5단계: 지바이크 앱 SMS 서비스 수정

이제 Cloudflare Workers에서 AWS Lambda를 호출하도록 수정하겠습니다.

---

## 환경변수 설정

### Cloudflare Secrets
```bash
# AWS Lambda URL
npx wrangler pages secret put SMS_AWS_LAMBDA_URL --project-name zbike-webapp
# 값: https://abc123.lambda-url.ap-northeast-2.on.aws/

# (선택) API Key (보안 강화)
npx wrangler pages secret put SMS_AWS_API_KEY --project-name zbike-webapp
```

---

## 비용 예상

### AWS Lambda (무료 티어)
- 월 100만 건 무료
- SMS 1건당 Lambda 호출 1회
- **결론: 거의 무료**

### NAT Gateway
- 시간당 $0.059 (~월 $45)
- 데이터 처리: GB당 $0.059
- **결론: 월 $50 정도**

### 대안: VPC 없이 사용
- NAT Gateway 없이 Lambda 사용 가능
- 알리고에서 Lambda IP 범위 전체 화이트리스트 필요
- **비용: 거의 무료**

---

## 다음 단계

지금 AWS Lambda를 배포하시겠습니까?

1. **수동 배포** (AWS 콘솔)
   - 위 Lambda 코드 복사
   - 환경변수 설정
   - Function URL 생성

2. **자동 배포** (제가 스크립트 작성)
   - AWS CLI 명령어
   - Terraform 코드

어떤 방식이 좋으신가요?
