#!/bin/bash

# AWS Lambda 배포 스크립트
# 
# 사용법:
#   chmod +x deploy-lambda.sh
#   ./deploy-lambda.sh
#
# 사전 요구사항:
#   - AWS CLI 설치 및 구성 (aws configure)
#   - Lambda 실행 역할 ARN

set -e

echo "🚀 AWS Lambda SMS 중계 함수 배포 시작"
echo ""

# 설정
FUNCTION_NAME="zbike-sms-relay"
RUNTIME="nodejs20.x"
HANDLER="index.handler"
TIMEOUT=30
MEMORY=256

# 알리고 설정
ALIGO_API_KEY="pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9"
ALIGO_USER_ID="pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9"
ALIGO_SENDER="01086046995"

# AWS 설정 확인
echo "📋 AWS 설정 확인 중..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [ -z "$AWS_REGION" ]; then
  AWS_REGION="ap-northeast-2"
  echo "⚠️  리전이 설정되지 않아 기본값 사용: $AWS_REGION"
fi

echo "✅ AWS 계정: $AWS_ACCOUNT_ID"
echo "✅ AWS 리전: $AWS_REGION"
echo ""

# Lambda 실행 역할 확인/생성
ROLE_NAME="zbike-lambda-execution-role"
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "📝 Lambda 실행 역할 생성 중..."
  
  # Trust Policy 생성
  cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  # 역할 생성
  ROLE_ARN=$(aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file:///tmp/trust-policy.json \
    --query 'Role.Arn' \
    --output text)
  
  # 기본 Lambda 실행 정책 연결
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  echo "✅ 역할 생성 완료: $ROLE_ARN"
  echo "⏳ 역할 전파 대기 중 (10초)..."
  sleep 10
else
  echo "✅ 기존 역할 사용: $ROLE_ARN"
fi

echo ""

# ZIP 파일 생성
echo "📦 Lambda 함수 패키징 중..."
cd "$(dirname "$0")"
rm -f function.zip
zip -q function.zip index.mjs package.json
echo "✅ function.zip 생성 완료"
echo ""

# Lambda 함수 존재 여부 확인
FUNCTION_EXISTS=$(aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null && echo "yes" || echo "no")

if [ "$FUNCTION_EXISTS" = "yes" ]; then
  echo "🔄 기존 Lambda 함수 업데이트 중..."
  
  # 코드 업데이트
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --output text > /dev/null
  
  # 환경변수 업데이트
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment "Variables={ALIGO_API_KEY=$ALIGO_API_KEY,ALIGO_USER_ID=$ALIGO_USER_ID,ALIGO_SENDER=$ALIGO_SENDER}" \
    --output text > /dev/null
  
  echo "✅ Lambda 함수 업데이트 완료"
else
  echo "🆕 새 Lambda 함수 생성 중..."
  
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime $RUNTIME \
    --role $ROLE_ARN \
    --handler $HANDLER \
    --zip-file fileb://function.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment "Variables={ALIGO_API_KEY=$ALIGO_API_KEY,ALIGO_USER_ID=$ALIGO_USER_ID,ALIGO_SENDER=$ALIGO_SENDER}" \
    --output text > /dev/null
  
  echo "✅ Lambda 함수 생성 완료"
fi

echo ""

# Function URL 확인/생성
echo "🔗 Function URL 확인 중..."
FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --query 'FunctionUrl' --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_URL" ]; then
  echo "📝 Function URL 생성 중..."
  
  FUNCTION_URL=$(aws lambda create-function-url-config \
    --function-name $FUNCTION_NAME \
    --auth-type NONE \
    --cors "AllowOrigins=*,AllowMethods=POST,AllowHeaders=Content-Type" \
    --query 'FunctionUrl' \
    --output text)
  
  # Public 권한 추가
  aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --output text > /dev/null
  
  echo "✅ Function URL 생성 완료"
else
  echo "✅ 기존 Function URL 사용"
fi

echo ""
echo "========================================="
echo "✅ 배포 완료!"
echo "========================================="
echo ""
echo "📱 Lambda 함수: $FUNCTION_NAME"
echo "🌍 리전: $AWS_REGION"
echo "🔗 Function URL:"
echo "   $FUNCTION_URL"
echo ""
echo "========================================="
echo "다음 단계:"
echo "========================================="
echo ""
echo "1. .dev.vars 파일에 Function URL 추가:"
echo "   SMS_AWS_LAMBDA_URL=$FUNCTION_URL"
echo ""
echo "2. Cloudflare Secrets 설정 (프로덕션):"
echo "   npx wrangler pages secret put SMS_AWS_LAMBDA_URL --project-name zbike-webapp"
echo "   값 입력: $FUNCTION_URL"
echo ""
echo "3. SMS 기능 활성화:"
echo "   .dev.vars에서 SMS_ENABLED=true 설정"
echo ""
echo "4. 테스트:"
echo "   curl -X POST $FUNCTION_URL \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"action\":\"balance\"}'"
echo ""
echo "========================================="
