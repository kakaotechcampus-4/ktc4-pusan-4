# Jev · Luna 6 `/decisions` 카테고리 분류 비교

결과 문서: [`docs/category_decision_eval.md`](../../docs/category_decision_eval.md)

이슈 #145 결정(Plaid 흐름 끝에 jev 또는 6luna 의 `/decisions` 를 붙인다)에서 둘 중 무엇을 쓸지 재는 실험이다.
팔 표기는 J(Jev) · L(Luna)이다.

| 파일 | 역할 |
|---|---|
| `common.py` | 자격증명, 두 팔의 요청 빌더(형식만 다르고 내용은 같다), 응답 파서, 배치, 캐시 |
| `build_testset.py` | 상권정보 전국 + 레포 라벨 → `data/testset.jsonl` |
| `run.py` | 평가셋을 두 팔에 보내고 응답을 `data/cache.jsonl` 에 쌓는다 |
| `score.py` | 캐시만으로 채점한다(모델 호출 0회) |
| `threshold_grid.py` | NK 판에서 자동 확정 규칙 "예 ≥ k 그리고 1등 신뢰도 ≥ t" 격자와 오답 목록(캐시만 읽는다) |

## 준비

- J: 레포 루트 `.env.jev` 에 `JEV_API_KEY`, `JEV_BASE_URL`
- L: 메인 레포 `.env` 의 `AGENT_API_KEY`, `AGENT_BASE_URL` (워크트리에서는 `git rev-parse --git-common-dir` 로 찾는다. `LUNA_ENV=<경로>` 로 바꿀 수 있다)
- 상권정보: 공공데이터포털 「소상공인시장진흥공단_상가(상권)정보」 시도별 CSV 폴더

**키 · 게이트웨이 주소는 절대 커밋하지 않는다(이 repo 는 public).** `data/` 와 `.env.*` 는 gitignore 다.

## 실행

시스템 Python 과 `pyyaml` 만 있으면 된다. HTTP 는 표준 라이브러리로 보낸다.

```bash
SANGKWON_DIR=<상권정보 폴더> python tools/exp_decision_cls/build_testset.py   # 약 2분

python tools/exp_decision_cls/run.py --arm J L --set res --split dev
python tools/exp_decision_cls/run.py --arm J L --set res kwonly repo --split test
python tools/exp_decision_cls/run.py --arm J L --set res --split test --batch 30 --workers 1
python tools/exp_decision_cls/run.py --arm J L --set res --split test --limit 100 --repeat 3

python tools/exp_decision_cls/score.py --set res --split test
python tools/exp_decision_cls/score.py --set res --split test --batch 30
python tools/exp_decision_cls/score.py --set res --split test --limit 100 --repeat 3
python tools/exp_decision_cls/score.py --set res --split test --review 50

python tools/exp_decision_cls/threshold_grid.py                      # test 격자
python tools/exp_decision_cls/threshold_grid.py --split dev --errors 0.99 1.0
```

- 같은 요청은 캐시에서 꺼내고 다시 보내지 않는다. 실패한 요청만 다시 보낸다
- 선택지 설명 판은 `DECISION_DESC=meta|mapping`(기본 `mapping`)으로 고른다. dev 비교 말고는 바꾸지 않는다
- 질문 판은 `DECISION_CHOICES=all|no_other`(기타 포함 · 제외)와 `DECISION_KNOWN=1`(예/아니오 질문 추가)로 고른다.
  `run.py` 와 `score.py` 에 같은 값을 줘야 캐시를 찾는다
  ```bash
  DECISION_CHOICES=no_other DECISION_KNOWN=1 python tools/exp_decision_cls/run.py --arm J L --set res kwonly repo --split test
  DECISION_CHOICES=no_other DECISION_KNOWN=1 python tools/exp_decision_cls/score.py --set res --split test
  ```
- `score.py --drop-other` 는 정답이 기타인 건을 빼고 채점한다(기타 제외 판과 공정하게 비교할 때)
- Jev 는 버전을 붙인 이름만 받는다. 기본 `typesafe/jev-1.14`, `JEV_MODEL` 로 바꾼다
