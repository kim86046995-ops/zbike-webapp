#!/bin/bash

BASE_URL="https://zbike-webapp.pages.dev"
SESSION_ID="$1"

if [ -z "$SESSION_ID" ]; then
    echo "❌ SESSION_ID가 필요합니다."
    echo "사용법: ./cleanup-data.sh <SESSION_ID>"
    exit 1
fi

echo "🧹 테스트 데이터 삭제 시작..."
echo ""

# 1. 차용증 삭제
echo "1️⃣ 차용증 삭제 중..."
LOANS=$(curl -s -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/loan-contracts")
LOAN_IDS=$(echo "$LOANS" | grep -o '"id":[0-9]*' | cut -d':' -f2)
LOAN_COUNT=$(echo "$LOAN_IDS" | wc -w)
echo "   차용증 $LOAN_COUNT개 발견"
for ID in $LOAN_IDS; do
    curl -s -X DELETE -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/loan-contracts/$ID" > /dev/null
    echo "   ✅ 차용증 ID $ID 삭제 완료"
done

# 2. 업체 계약서 삭제
echo ""
echo "2️⃣ 업체 계약서 삭제 중..."
BUSINESS=$(curl -s -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/business-contracts")
BUSINESS_IDS=$(echo "$BUSINESS" | grep -o '"id":[0-9]*' | cut -d':' -f2)
BUSINESS_COUNT=$(echo "$BUSINESS_IDS" | wc -w)
echo "   업체 계약서 $BUSINESS_COUNT개 발견"
for ID in $BUSINESS_IDS; do
    curl -s -X DELETE -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/business-contracts/$ID" > /dev/null
    echo "   ✅ 업체 계약서 ID $ID 삭제 완료"
done

# 3. 개인 계약서 삭제
echo ""
echo "3️⃣ 개인 계약서 삭제 중..."
CONTRACTS=$(curl -s -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/contracts")
CONTRACT_IDS=$(echo "$CONTRACTS" | grep -o '"id":[0-9]*' | cut -d':' -f2)
CONTRACT_COUNT=$(echo "$CONTRACT_IDS" | wc -w)
echo "   개인 계약서 $CONTRACT_COUNT개 발견"
for ID in $CONTRACT_IDS; do
    curl -s -X DELETE -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/contracts/$ID" > /dev/null
    echo "   ✅ 개인 계약서 ID $ID 삭제 완료"
done

# 4. 오토바이 삭제
echo ""
echo "4️⃣ 오토바이 삭제 중..."
MOTORCYCLES=$(curl -s -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/motorcycles")
MOTORCYCLE_IDS=$(echo "$MOTORCYCLES" | grep -o '"id":[0-9]*' | cut -d':' -f2)
MOTORCYCLE_COUNT=$(echo "$MOTORCYCLE_IDS" | wc -w)
echo "   오토바이 $MOTORCYCLE_COUNT개 발견"
for ID in $MOTORCYCLE_IDS; do
    curl -s -X DELETE -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/motorcycles/$ID" > /dev/null
    echo "   ✅ 오토바이 ID $ID 삭제 완료"
done

# 5. 고객 삭제
echo ""
echo "5️⃣ 고객 삭제 중..."
CUSTOMERS=$(curl -s -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/customers")
CUSTOMER_IDS=$(echo "$CUSTOMERS" | grep -o '"id":[0-9]*' | cut -d':' -f2)
CUSTOMER_COUNT=$(echo "$CUSTOMER_IDS" | wc -w)
echo "   고객 $CUSTOMER_COUNT명 발견"
for ID in $CUSTOMER_IDS; do
    curl -s -X DELETE -H "X-Session-ID: $SESSION_ID" "$BASE_URL/api/customers/$ID" > /dev/null
    echo "   ✅ 고객 ID $ID 삭제 완료"
done

echo ""
echo "✨ 모든 테스트 데이터 삭제 완료!"
echo "이제 실제 데이터를 입력할 수 있습니다."
