# 거래 목록 화면과 Table·FilterBar 부품

- 브랜치: `feature/transactions` (스택: `feature/classification-preview` 위)
- 커밋: 1개
- 주요파일: `frontend/src/pages/Transactions.tsx`, `frontend/src/components/ui/Table.tsx`, `frontend/src/components/ui/FilterBar.tsx`

## 한 일

- `/transactions` 를 만들었다. `GET /transactions` 로 목록을 받아 승인일·가맹점·분류·금액·판정 대상 5열로 보여준다.
- 판정 대상 열에서 `POST /transactions/{id}/exclude` · `/include` 를 호출한다. `sourceStatus = CANCELED_OFFSET` 이면 버튼 대신 배지만 둔다(2.3 — 파서가 정하고 사용자가 못 바꾼다).
- 필터는 판정 대상 상태 4개(전체·판정대상·대상제외·취소상계)와 월 선택이다. 필터를 바꾸면 페이지를 0으로 되돌린다.
- `ui/Table` 과 `ui/Pagination`, `ui/FilterBar` 를 새로 만들었다. `/styleguide` 예시와 `DESIGN.md` 규칙을 같은 커밋에 넣었다.

## 왜 이렇게 했나

- **Table 을 먼저 만들었다**: 거래 목록·업로드 이력·판정 결과 세 화면이 같이 쓴다. 분담상 결과 목록은 치오 몫이지만 부품이 아직 없어서, "상대 영역 부품이 먼저 필요하면 만들고 공유한다" 는 규칙대로 내가 만들고 알린다.
- **정렬·페이지네이션을 부품에 넣지 않았다**: 계약이 서버 정렬(`approvedAt DESC, id DESC`)과 서버 페이지네이션(0-based)을 규정한다. 화면에서 다시 정렬하면 서버와 갈라진다.
- **취소상계에 버튼을 두지 않았다**: 눌러도 `409 CANCELED_TRANSACTION_NOT_INCLUDABLE` 이 돌아온다. 눌리는데 실패하는 버튼보다 애초에 없는 편이 낫다(`DESIGN.md` 의 "눌리는데 아무 일 없는 버튼은 만들지 않는다" 와 같은 이유).
- **`hideBelow` 를 분류 열에만 걸었다**: 금액·판정 대상은 이 화면의 핵심이라 좁은 화면에서도 남긴다.
- **승인일에 `whitespace-nowrap`**: `2026. 01. 31` 이 두 줄로 깨졌다.

## 남은 것 · 아는 문제

- 가맹점명 검색(FR-33)은 아직 없다. 계약에 검색 쿼리가 없어서 추가되면 붙인다.
- 페이지 크기 20을 `Pagination` 이 하드코딩해 범위(`1–20`)를 계산한다. 다른 크기를 쓰는 화면이 생기면 `size` 를 받아야 한다.
- `npm run lint` 경고 11건은 그대로다. 오류는 0건. 이번에 쇼케이스의 빈 화살표 함수 1건이 **오류**로 잡혀 고쳤다 — CI 가 프론트 lint 를 돌리므로 PR 전에 반드시 확인해야 한다.
- 이 브랜치는 `feature/classification-preview`(PR #63) 위에 쌓았다. `ui/Empty` 가 거기 있어서다. #63 이 머지되면 develop 기준으로 정리된다.
