# 확정된 PreeT 브랜드 에셋 추가

- 브랜치: feature/brand-assets
- 주요파일: frontend/public/favicon.svg, frontend/src/assets/brand/

## 한 일

- 디자인 이슈 #235(Really 버튼), #236(탭 아이콘), #237(헤더 로고)에서 정한 에셋을 넣었다.
- 파비콘 세트는 `frontend/public/` 에 넣었다. `favicon.svg` 는 막대 셋 임시 아이콘을 P + 핑크 배지 점으로 바꿨다.
- 로고, 앱 아이콘, Really 버튼 SVG·PNG, 색상 변수(`tokens.css`), 사용법(`README.md`)은 `frontend/src/assets/brand/` 에 넣었다.

## 왜 이렇게 했나

화면 코드는 건드리지 않았다. 헤더 로고와 Really 버튼 교체, `index.html` 의 나머지 아이콘·manifest 연결은 FE 담당이 이 에셋을 써서 따로 한다.

## 남은 것 · 아는 문제

- `index.html` 은 지금 `favicon.svg` 만 연결돼 있다. `favicon.ico`, `apple-touch-icon.png`, `site.webmanifest` 연결은 화면 적용 때 한다.

## 15:00 기존 파일은 건드리지 않고 폴더만 올리는 것으로 바꿈

- `frontend/public/favicon.svg` 덮어쓰기를 되돌리고, `public/` 에 넣었던 파비콘 세트를 뺐다.
- 브랜드 폴더를 원본 구조 그대로 `frontend/src/assets/brand/` 한 곳에만 넣었다(`favicon/` 포함).
- 이 PR 은 새 파일 추가만 한다. 탭 아이콘·헤더 로고·Really 버튼 적용은 FE 담당이 따로 한다.
