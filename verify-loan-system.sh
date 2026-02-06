#!/bin/bash
# 차용증 시스템 검증 스크립트

echo "🔍 차용증 시스템 검증 시작..."
echo ""

# 1. 서비스 상태 확인
echo "1️⃣ 서비스 상태 확인"
if curl -s http://localhost:3000/api/loan-contracts/2 > /dev/null; then
    echo "✅ API 서버 정상"
else
    echo "❌ API 서버 오류"
    exit 1
fi

# 2. 데이터 확인
echo ""
echo "2️⃣ 차용증 데이터 확인"
DATA=$(curl -s http://localhost:3000/api/loan-contracts/2)
SIG_LEN=$(echo "$DATA" | jq -r '.borrower_signature | length')
ID_LEN=$(echo "$DATA" | jq -r '.borrower_id_card_photo | length')

echo "   서명 이미지 길이: $SIG_LEN bytes"
echo "   신분증 이미지 길이: $ID_LEN bytes"

if [ "$SIG_LEN" -gt 1000 ] && [ "$ID_LEN" -gt 1000 ]; then
    echo "✅ 이미지 데이터 정상"
else
    echo "❌ 이미지 데이터 손상"
    exit 1
fi

# 3. HTML 파일 검증
echo ""
echo "3️⃣ HTML 파일 검증"
LOAN_PDF_COUNT=$(grep -c "LoanPDFGenerator" /home/user/webapp/public/static/loans.html)
DOWNLOAD_COUNT=$(grep -c "downloadLoanPDF" /home/user/webapp/public/static/loans.html)

echo "   LoanPDFGenerator 참조 횟수: $LOAN_PDF_COUNT"
echo "   downloadLoanPDF 참조 횟수: $DOWNLOAD_COUNT"

if [ "$LOAN_PDF_COUNT" -ge 2 ] && [ "$DOWNLOAD_COUNT" -ge 3 ]; then
    echo "✅ HTML 파일 정상"
else
    echo "❌ HTML 파일 오류"
    exit 1
fi

# 4. pdfContainer 숨김 확인
echo ""
echo "4️⃣ 인쇄 CSS 검증"
if grep -q "#pdfContainer.*display: none" /home/user/webapp/public/static/loans.html; then
    echo "✅ pdfContainer 숨김 설정 확인"
else
    echo "⚠️  pdfContainer 숨김 설정 미확인"
fi

# 5. 함수 이름 충돌 확인
echo ""
echo "5️⃣ 함수 이름 충돌 검사"
LOAN_HTML=$(curl -s http://localhost:3000/static/loans)
if echo "$LOAN_HTML" | grep -q "LoanPDFGenerator"; then
    if echo "$LOAN_HTML" | grep -q "\[차용증\]"; then
        echo "✅ 차용증 전용 함수 확인"
    else
        echo "⚠️  로그 접두사 없음"
    fi
else
    echo "❌ LoanPDFGenerator 없음"
    exit 1
fi

# 최종 결과
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 모든 검증 통과!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 13시간 후 테스트 URL:"
echo "https://3000-ikdibnajukplmgra2ipiv-2b54fc91.sandbox.novita.ai/static/loans"
echo ""
echo "🎯 테스트 대상:"
echo "   - 김상춘 (LOAN-20260201-0002)"
echo "   - PDF 다운로드 버튼"
echo "   - 콘솔 로그 확인: [차용증] 접두사"
echo ""
