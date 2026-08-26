# 브랜치 정보

## 현재 브랜치
- `feature/corporate-contract`: 법인 계약서 기능 추가됨

## 원점으로 돌아가기 (법인 기능 제거)
```bash
git checkout work-contract-safe
```

## 법인 기능 다시 적용하기
```bash
git checkout feature/corporate-contract
```

## 브랜치 목록 확인
```bash
git branch -a
```

## 변경사항 확인
```bash
git log --oneline --graph --all
```

## 배포 URL
- **법인 기능 포함**: https://feature-corporate-contract.zbike-webapp.pages.dev
- **원본 (법인 기능 없음)**: https://work-contract-safe.zbike-webapp.pages.dev
