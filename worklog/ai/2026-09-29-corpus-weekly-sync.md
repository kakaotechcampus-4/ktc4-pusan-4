# 법령 코퍼스 주간 자동 최신화 파이프라인

- 브랜치: feature/corpus-autoupdate
- 커밋: b8feefe..6db90c0 (7개)
- 주요파일: ai/pipeline/reindex.py, ai/pipeline/law_sync.py, deploy/corpus-sync.sh, docs/deployment.md

## 한 일

- `reindex --incremental`
  - 닫힌 원문 행의 `effective_to`·`is_superseded` 를 `legal_chunk` 에 반영한다 (b8feefe)
  - 법령·행정규칙은 현행 행만 청킹하고, 청크 본문 md5 를 원문 행 단위로 비교해 달라진 행만 다시
    임베딩한다(`stale()`)
  - 심판례·해석례는 바뀐 행만 SQL 로 읽는다
- `law_sync`
  - `sweep()` 에 doc_type 인자를 두고 행정규칙에도 돌린다 (9f59933)
  - 목록 페이지마다 totalCnt 가 같고 누적 건수와 일치할 때만 sweep 한다(`complete()`)
  - 사례 본문 조회가 재시도 끝에 실패하면 그 문서만 건너뛴다(`_case_body`) (d67cdf6)
- `parse`: 행정규칙 `제9조 <삭제>` 형태를 껍데기 조문으로 거른다. `verify` 의 삭제 조문 검사는
  현행 행만 본다 (5d3eb1f)
- `ai/Dockerfile` 에 `COPY pipeline` 을 추가했다 (b7ab305)
- 스케줄러 (e761c9d)
  - `deploy/corpus-sync.sh` 와 `ktc4-corpus.service`·`.timer` 를 새로 만들었다. 토 19:00 UTC,
    즉 일 04:00 KST 에 돈다
  - 배포 락을 잡고 law·admrul·expc·decc 를 차례로 동기화한 뒤 `reindex --incremental` 을 돌린다
- 문서: deployment.md §6 를 추가하고 architecture·law_api·rag-eval 의 주기와 해결 항목을 고쳤다 (6db90c0)

로컬 리허설(9/8 코퍼스 → 9/29):
- 법령 변경 387(닫힘 380), 행정규칙 변경 99(닫힘 91), 해석례 4 · 심판례 16
- 재색인은 superseded 반영 296청크, 331행 재임베딩. 두 번째 실행은 0건이었다
- 닫힌 원문을 가리키는 현행 청크 0, 현행 버전이 둘인 statute_id 0

## 왜 이렇게 했나

- 트리거는 EC2 systemd timer 로 정했다(사용자 결정). GH cron 은 5시간 지연 전례가 있고 DB 가 SSM
  너머에 있다. 03:00 KST 백업 1시간 뒤라 백업이 복구 지점이 된다
- 기존 증분 재색인에는 문제가 셋 있었다
  - 옛 조문이 현행으로 계속 검색됐다
  - `chunk_statutes` 가 버전을 섞어 읽었다
  - 부모 문구만 바뀐 호는 해시가 같아 다시 색인되지 않았다
  - 청크 본문 비교 하나로 셋을 다 잡는다
- 비교는 원문 행 단위다. `write()` 가 행 단위로 지우고 넣으므로 seq 하나만 넣으면 나머지 조각이 사라진다
- 심판례는 162MB 라 운영 ai 컨테이너(512MB)에서 전량을 읽지 않는다
- 행정규칙 sweep 에 완결 판정을 둔 이유: `_rows` 는 빈 페이지를 끝으로 여긴다. 중간 페이지가 비면
  멀쩡한 규칙이 폐지로 닫힌다. 9/29 국세청 실측은 100/100/1 건, totalCnt 201 이었다
- 사례만 건너뛰는 이유
  - 판례 104905 는 매번 타임아웃이라 대상 전체가 매주 같은 자리에서 멈췄다
  - 법령·행정규칙은 건너뛰면 sweep 이 그 조문을 닫으므로 지금처럼 중단한다
- 판례(prec)는 주간 대상에서 뺐다(사용자 결정). 운영 코퍼스에 0건이고, 로컬에 들어간 500건 중
  348건이 verify 의 당사자 주장 혼입에 걸린다
- 동기화가 실패해도 재색인은 돌린다. 앞 대상이 실패했다고 이미 적재된 개정분이 검색에 안 보이면 안 된다

## 남은 것 · 아는 문제

- 운영 반영 절차(deployment.md §6)
  - 배포 뒤 EC2 에서 타이머를 설치하고 첫 실행은 수동으로 한다
  - 운영은 아직 9/8 코퍼스다
- 운영 `LAW_API_OC` 를 발급 키로 바꿨지만, EC2 IP 에서 동작하는지는 확인하지 않았다
- 로컬 DB 에 판례 500행이 색인 없이 남아 있다
- 과거 시행본(eflaw + efYd)은 여전히 없다. 2025 귀속 조회는 이 파이프라인으로 해결되지 않는다
- `ADMRUL_ORGS` 가 둘 이상이 되면 totalCnt 가 섞여 행정규칙 sweep 이 늘 건너뛰어진다(ponytail 주석)
