#!/bin/bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 차용증 시스템 빠른 테스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 서버 상태
if pm2 list | grep -q "online"; then
    echo "✅ 서버: 실행 중"
else
    echo "❌ 서버: 중지됨"
    echo "   → pm2 start ecosystem.config.cjs"
    exit 1
fi

# 데이터 확인
echo ""
echo "📊 LOAN-2 데이터:"
curl -s http://localhost:3000/api/loan-contracts/2 | jq -r '
"   이름: \(.borrower_name)
   번호: \(.loan_number)
   서명: \(.borrower_signature | length) bytes
   신분증: \(.borrower_id_card_photo | length) bytes"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 테스트 URL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans"
echo ""
echo "📋 체크리스트:"
echo "   □ 시크릿 모드로 열기"
echo "   □ F12 → Console 열기"
echo "   □ '김상춘' 선택"
echo "   □ PDF 다운로드 클릭"
echo "   □ 콘솔에서 '[차용증]' 로그 확인"
echo ""
