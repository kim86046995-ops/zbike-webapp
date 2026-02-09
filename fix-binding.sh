#!/bin/bash

# Cloudflare API를 사용하여 D1 바인딩 확인
ACCOUNT_ID="8bec12a864b64ef4f60888dc443e97ce"
PROJECT_NAME="zbike-webapp"
API_TOKEN="cm9_5dJP5FzU6mn4K7xHSATQIVQH7pz9Q2LvzVjW"

echo "🔍 현재 프로젝트 설정 확인 중..."

# 프로젝트 정보 조회
curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" | jq '.result.deployment_configs'

