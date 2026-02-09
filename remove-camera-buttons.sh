#!/bin/bash

FILES=(
  "public/static/contract-new.html"
  "public/static/loan-new.html"
  "public/static/business-contract-new.html"
  "public/static/contract-sign.html"
  "public/static/companies-backup.html"
  "public/static/companies-broken.html"
  "public/static/customer-contract.html"
  "public/static/customer-loan.html"
)

for file in "${FILES[@]}"; do
  echo "Processing $file..."
  
  # 카메라 버튼 제거 (여러 패턴)
  sed -i '/<button.*startCamera\|카메라로 촬영.*button/d' "$file"
  sed -i '/onclick="startIdCardCamera()\|onclick="startSignatureCamera()/d' "$file"
  
  echo "✓ Done"
done

echo "모든 파일 처리 완료!"
