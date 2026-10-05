# 미분류 상세·지점 미분리 표의 중복 제거 키에 트랙 포함 (PR #49 리뷰 반영)

- 브랜치: feature/unclassified-detail
- 커밋: edbd8af (1개)
- 주요파일: `tools/analyze_unclassified.py`

## 한 일

- `detail_rows()` 와 `blocked_rows()` 의 중복 제거 키를 `raw_merchant` 에서
  `(raw_merchant, track, norm_key)` 로 바꿨다. 두 함수가 같은 키를 쓰도록
  `row_key()` 하나로 뽑았다.
- 거래건수·합계금액 집계 키도 같은 키로 바꿨다.
- `--selftest` 에 합성 케이스 추가 — 같은 상호가 사업자번호 있는 행 1개 + 없는
  행 1개면 두 행이 모두 남고, 건수·금액이 행별로 나뉜다.

## 왜 이렇게 했나

- 리뷰 지적: KB 는 사업자번호가 항상 비고 IBK 는 채워져 있어, 같은 상호를 두
  카드로 결제하면 한 상호가 bizno 트랙과 string 트랙을 동시에 가진다.
  `raw_merchant` 로만 거르면 먼저 나온 행의 트랙만 남는다.
- 집계 키까지 바꾼 이유: 중복 제거만 바꾸면 갈라진 두 행이 각자 상호 전체 건수를
  들고 나와 누적 커버리지가 이중 집계된다.

## 남은 것 · 아는 문제

- 현재 데이터에는 영향이 없다. 제품경로 KB 가 5행·3상호이고 IBK 와 겹치는
  상호가 없다. `--detail` / `--blocked` 출력 CSV 가 수정 전과 바이트 단위로 같다.
- 전체 326행으로 넓히면 같은 상호가 IBK(bizno)·teammate(string)로 갈리는 경우가
  1건 있다. 제품경로만 보는 `detail_rows()` 와 지점 미분리만 보는 `blocked_rows()`
  에는 걸리지 않아 지금은 영향이 없었다. 이번 수정으로 앞으로도 막힌다.
