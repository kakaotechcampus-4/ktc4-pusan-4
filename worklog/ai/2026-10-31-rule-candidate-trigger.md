# 규칙 후보 주간 트리거(EC2 timer)와 승인 후보 카드 PR 자동 생성

- 브랜치: feature/rag-trigger
- 커밋: b22d854..3b03684 (3개)
- 주요파일: ai/pipeline/promote.py, deploy/rule-candidates.sh, ai/pipeline/notify.py, docs/deployment.md

## 한 일

- `python -m pipeline.promote [--dry-run]` 을 새로 만들었다 (b22d854)
  - 정리: PR 이 열린 승인 후보마다 PR 을 조회한다. 닫혔고 develop 에 카드 파일이 있으면 `promoted_rule_id` 를 기록한다.
    파일이 없으면 `대기` 로 되돌리고 `pr_url` · `reviewed_by` · `reviewed_at` 을 비운다
  - 수집: `status='승인' AND pr_url IS NULL`. 초안이 없거나 `finalize` 가 실패한 후보는 건너뛰고 출력에 남긴다
  - `finalize`: `render()` 초안의 `id: TODO` · `effective_period.start: TODO` · `review.by: 미검수` 와 안내 주석을 한 줄씩 바꾼다.
    id 는 `R-C<후보 id>`, 효력 시작일과 검수일은 승인일(KST), 검수자는 `관리자` 다
  - PR: GitHub REST 를 urllib 으로 부른다. `feature/rule-candidates-<날짜>` 브랜치를 만들고 카드마다 contents PUT 으로 커밋한 뒤
    develop 대상 PR 하나를 연다. 그다음 후보에 `pr_url` 을 기록한다
  - 설정 `rules_pr_token` · `rules_pr_repo` 를 추가했다. 토큰이 없으면 종료 코드 1 이다
- `deploy/rule-candidates.sh` 와 `ktc4-rule-candidates.{service,timer}` 를 추가했다 (545dcdc)
  - 일 05:00 KST 에 promote → candidates(`--limit 10`) → notify 순서로 돈다. `corpus-sync.sh` 와 같은 배포 락을 쓴다
  - 토큰은 `run -e RULES_PR_TOKEN` 으로 promote 단계에만 넘긴다. compose.yaml 은 고치지 않았다
  - ai 컨테이너에 `docs` · `profiles` 를 읽기 전용으로 마운트한다
- `pipeline.notify` 는 세 단계 출력과 실패한 단계 이름을 디스코드로 보낸다. `sync_report` 의 `post` · `_fence` 를 그대로 쓴다 (545dcdc)
- 문서 넷을 현행 스펙으로 고쳤다 (3b03684)
  - `docs/deployment.md` §11: PAT 발급, 타이머 설치, PR 처리법
  - `CONTEXT.md`: 트리거를 EC2 timer 로, "승인 시 PR" 을 "주 1회 모아 PR" 로
  - `docs/architecture.md`: 승인 흐름과 "아직 없는 것"
  - `docs/rule-card-fields.md`: `R-C<id>` 와 `review.by: 관리자`

검증:
- `test_promote.py` 4건 추가. ai pytest 216건 · ruff 통과
- dry-run 으로 만든 카드를 `rules/cards/` 에 임시로 두고 backend `RuleCardLoader` · `EvalHarnessTest` 통과를 확인했다
- ai 이미지를 빌드해 마운트 없이 돌리면 `/docs/categories.md` 없음으로 죽고, 마운트하면 통과하는 것을 확인했다
- 실제 팀 레포에서 임시 DB 로 돌렸다. `[테스트]` PR #199 가 생겼고 CI(backend · ai · web)가 모두 통과했다.
  PR 을 닫고 다시 돌리면 후보가 `대기` 로 돌아가고 새 PR 은 생기지 않았다. PR 과 브랜치는 지웠다

## 왜 이렇게 했나

- GH Actions cron 이 아니라 EC2 timer 를 골랐다. DB 가 EC2 의 compose postgres 이고 5432 를 닫아 SSM 으로만 들어가므로 러너에서 닿지 않는다
- 효력 시작일은 승인일이고 소급하지 않는다. 기존 카드와 같은 원칙이다
- 판정을 PR 의 merged 여부가 아니라 develop 에 파일이 있는지로 한다. PR 에서 카드 하나만 지우고 머지한 경우도 맞게 처리된다
- 레포가 PUBLIC 이라 `reviewed_by`(관리자 이메일)는 SELECT 하지 않는다. 카드와 PR 에는 `관리자` 만 남는다
- 파일명을 `R-C<id>_<카테고리>.yaml` 로 한 건 `ProfileCardGenerator` 가 지우는 패턴 `R-\d{9}_` 를 피하려고서다
- 이미지 안에서 `ROOT` 가 `/` 로 잡히는데 ai 이미지에 `docs/` 가 없어 `category_meta()` 가 바로 죽는다. 이미지를 바꾸는 대신 배치에서만 마운트했다
- Git Data API(tree · commit) 대신 contents PUT 을 썼다. 코드가 짧은 대신 카드마다 커밋이 하나씩 생긴다

## 남은 것 · 아는 문제

- 배포 뒤 EC2 에 타이머를 설치해야 한다(deployment.md §11). 서버에서의 첫 실행, 토큰 전달, 디스코드 메시지는 아직 보지 않았다
- PR 을 머지했을 때 `promoted_rule_id` 가 기록되는 경로는 가짜 GitHub 로만 확인했다
- 같은 날 다시 돌리면 브랜치가 이미 있어 422 가 난다(`shortcut` 주석). 브랜치를 지우고 다시 돌린다
- fine-grained PAT 는 만료일이 있다. 만료되면 promote 가 실패로 알림에 뜨니 `production.env` 를 갈아 끼운다
- M1(`feature/admin-rule-candidates`) 의 `docs/api.md` 3.14 와 `RuleCandidateReviewService` 주석에 "카드 PR 은 사람이 올린다" 가 남아 있다
- 관리자가 초안을 고치는 화면이 없다. 고칠 게 있으면 PR 에서 손으로 고친다. 화면에 PR 링크도 아직 안 보인다
