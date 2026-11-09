# 규칙 후보를 (카테고리 × 업종) 지정으로 만드는 --key 옵션

- 브랜치: feature/batch-diagonse
- 커밋: 9e72a82e..9e72a82e (1개)
- 주요파일: ai/pipeline/candidates.py, ai/tests/test_candidates.py, docs/deployment.md

## 한 일

- `python -m pipeline.candidates --key 카페/940909` 를 더했다. 미판정 집계를 건너뛰고 그 조합 한 줄로 기존 `propose()`(질의 → 검색 → 근거 선택 → 초안)를 돌려 `rule_candidate` 에 적재한다
  - `distinct_users` · `occurrence_count` 는 0 으로 넣는다. 테이블 CHECK 가 `>= 0` 이라 들어간다
  - 카테고리가 `docs/categories.md` 에 없거나 `/업종코드` 가 빠지면 DB 에 붙기 전에 `ap.error` 로 멈춘다
- 테스트 2건: `--key` 면 집계를 부르지 않고 그 조합만 적재한다, 잘못된 키는 에이전트를 돌리지 않는다
- `docs/deployment.md` §11 에 서버에서 `--key` 로 돌리는 명령을 적었다. 이미지 태그 · 마운트는 `rule-candidates.sh` 와 같다

검증:
- ruff 통과, ai pytest 243건 통과
- 이 PC 에 uv 가 없어 메인 체크아웃의 `ai/.venv` 파이썬으로 돌렸다. `PYTHONUTF8=1` 없이 돌리면 `test_answer_label_matches_frontend` 하나가 cp949 로 파일을 읽다 실패한다. 이번 변경과 무관하다

## 왜 이렇게 했나

- 11/08 서버를 보니 규칙 후보 타이머가 설치된 적이 없었다(설치 후 11/08 · 11/09 두 번 수동 실행, 둘 다 후보 0건)
- 운영 DB 를 읽기 전용으로 세 보니 판정 39,406건 중 `unmatched_reason` 이 있는 판정이 0건, `unmatched_log` 0행이었다.
  가입자 전원이 업종 940909 이고, 화면도 940909 만 고르게 막혀 있다(`JUDGED_INDUSTRY`). 940909 는 G2 카드가 없는 카테고리
  셋(G1 에서 먼저 불가)을 빼면 모든 카테고리에 카드가 있다. 그래서 집계로는 후보가 생길 수 없다
- 관리자 승인 → 카드 PR 흐름을 실제 화면에서 보려면 집계를 건너뛰는 입구가 필요했다. `--min-users 1` 은 재료가 0행이라 소용없다
- 카테고리를 검증하는 건 모르는 값이면 `meta.get()` 이 빈 성격을 돌려 그대로 LLM 을 부르기 때문이다
- 같은 조합 후보가 있는지는 보지 않는다. 사람이 명시적으로 돌리는 명령이라 막지 않았다

## 남은 것 · 아는 문제

- 시연 조합은 카페/940909 다(rag-eval §17 에서 결론이 가장 안정적인 키). 이미 `R-300_카페` 가 있어 초안이 겹친다.
  승인하면 다음 promote 가 겹치는 카드 PR 을 연다. 시연 뒤 기각하거나, 승인했다면 그 PR 은 머지하지 않고 닫는다
- `--key` 를 두 번 돌리면 같은 조합 후보가 두 행 생긴다
- `--key` 때도 첫 줄은 `후보 1건 (reason=RULE_NOT_FOUND, distinct_users>=2)` 로 찍힌다. 다음 줄에 `0건 · 0명` 이 나온다
