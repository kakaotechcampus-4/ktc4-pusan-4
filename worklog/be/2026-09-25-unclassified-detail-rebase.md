# PR #49 develop 충돌 해결 — 근거 갱신 커밋 제외하고 rebase

- 브랜치: feature/unclassified-detail
- 커밋: fb9fe1d..533a495 (3개)
- 주요파일: `tools/analyze_unclassified.py`, `rules/keyword_rules.yaml`

## 한 일

- PR #49 가 develop 과 `docs/api_questions.md` 에서 충돌했다. develop 의 ce91429
  (되묻기 일괄 응답 API 추가)가 이 파일을 계약 원본 `api.md` 로 가는 안내 문서로
  바꾸면서 `batch_size` 기본값 절을 통째로 지웠다.
- 우리 쪽 6460c22 는 그 절의 근거 문장(상위 15개/80% -> 16개/81.1%)만 고치는
  커밋이라, 고칠 대상이 없어졌다. 6460c22 를 빼고 나머지 3커밋을 develop 위로
  rebase 했다. 충돌 없이 올라갔다.
  - fb9fe1d 버스운송사업조합 키워드룰
  - 84d8d9c 미분류 상세표(--detail)
  - 533a495 키 분열 지표(원인별) + branch_blocked 전건 CSV(--blocked)
- selftest 4종 통과 (keyword 11/11 · validate errors=0 · normalize · analyze 2종).
- force-with-lease 로 올렸고 PR #49 는 MERGEABLE 이 됐다.
- 이슈 #54 생성 — F1 명세(`docs/feature_f1_question_stack.md`)의 `batch_size(잠정 15)`
  표현을 페이지네이션 기준으로 갱신하고, 삭제된 절을 가리키는 참조를 뗀다.
- PR #49 본문의 batch_size 근거 문단을 "근거 절이 ce91429 에서 삭제돼 문서 갱신은
  하지 않았고 F1 갱신은 #54 로 분리" 로 바꿨다.

## 왜 이렇게 했나

- 6460c22 를 억지로 살려 다른 문서로 옮기지 않았다. develop 에서 `batch_size` 개념
  자체가 사라지고 `page`/`size`(기본 20) 페이지네이션이 들어왔기 때문에, 근거를
  어디에 둘지는 계약 쪽 결정이다. 수치(16개/81.1%)는 PR #49 본문 표에 남아 있다.
- rebase 는 `reset --hard cfcf521` 후 `rebase origin/develop` 로 했다.
  `rebase --onto origin/develop 6460c22~3 cfcf521` 은 `6460c22~3` 이 룰 커밋
  fb9fe1d 의 원본(7f177f9)이라 룰 커밋까지 빠진다.

## 남은 것 · 아는 문제

- api.md 3.9 `GET /api/v1/questions` 의 정렬이 `createdAt ASC, id ASC` 다.
  첫 페이지가 효과 큰 상호가 아니라 먼저 생긴 질문이라, "상위 16개가 미분류 81.1%"
  근거가 페이지네이션에서 성립하지 않는다. #54 에서 거래 건수 DESC -> 금액 DESC ->
  id ASC 로 정하기로 했다.
- `rules/keyword_rules.yaml` 의 주석·test_case 에 상호명 원문이 한 곳 있다.
  공공·전국 단위 단체명이라 남겼다. 기준 문서화는 별도로 논의 중이다.
- 로컬 백업 브랜치 2개(pre-split, pre-rebase)는 PR 머지 후 지운다.
