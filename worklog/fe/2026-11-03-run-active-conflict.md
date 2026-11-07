# 판정 실행이 이미 돌고 있을 때(409) 그 실행으로 보낸다

- 브랜치: fix/fe-run-active-conflict (develop eebd836 위)
- 커밋: 6379840 (1개)
- 주요파일: frontend/src/api/http.ts, frontend/src/pages/Run.tsx, frontend/src/pages/Confirm.tsx

같은 날 `2026-11-03-fe-v1-followups.md` 가 있지만 거기 이어 쓰지 않고 따로 뒀다.
#226 의 FE 몫이 같은 문서 끝에 같이 붙어 두 PR 이 머지 순서에 따라 충돌한다.
기록 한 줄 때문에 PR 두 개를 엮지 않는다.

## 한 일

#228 의 FE 몫이다. BE 가 같은 업로드에 대기·실행 중인 run 이 있으면
`409 RUN_ALREADY_ACTIVE` 와 함께 본문에 진행 중인 `runId` 를 준다.

- `ApiRequestError` 에 `runId` 를 더했다. `http.ts` 가 에러 본문에서 읽어 올린다.
  문자열이 아니면 없는 것으로 둔다.
- `Confirm.tsx` 의 「판정 시작」, `Run.tsx` 의 「다시 판정하기」가 이 코드를 받으면
  일반 실패 문구 대신 `/run/{runId}` 로 간다.
- `Run.tsx` 의 `catch` 가 받은 오류를 버리고 있어 같이 고쳤다.

## 왜 이렇게 했나

- 헬퍼를 만들지 않고 호출 지점에서 `caught.code === '...'` 로 분기했다.
  `Signup.tsx:108`·`Results.tsx:43` 이 이미 그 꼴이다.
- `Run.tsx` 는 `caught.runId !== runId` 일 때만 이동한다. `RunProgress` 가
  `key={runId}`(`Run.tsx:61`)라 같은 id 로 이동하면 주소가 그대로여서 다시 그려지지
  않는데, 그 직전에 `setRun(null)` 을 해 둬서 빈 화면으로 남는다. 끝난 run 뒤
  재실행은 BE 가 막지 않으니 실제로는 나오지 않을 경우다.

## 확인

- `tsc` 오류 0, `npm test` 183개 통과(1개 파일 건너뜀), lint 오류 0(경고 10건은 원래 것).
- 새 테스트 2개(`http.test.ts`): 409 의 `runId` 를 올린다 / `runId` 가 없는 에러에는
  만들지 않는다. 앞 테스트는 `http.ts` 수정을 되돌리면 실패하는 것을 먼저 봤다.
- 브라우저(목업): 목업 `runs.create` 가 409 를 내도록 잠깐 고쳐 두 경로를 다 눌러 봤다.
  「판정 시작」 → `/run/run-temp-0001`, 부분 실패 뒤 「다시 판정하기」 → `/run/run-temp-0002`.
  확인 뒤 목업은 develop 과 바이트 단위로 같게 되돌렸다.
- `#226` 브랜치와 시험 머지해 충돌이 없는 것을 확인했다 (`git merge-tree`).

## 확인하지 못한 것

- **실제 서버로는 재지 못했다.** #228 이 아직 머지 전이라 `RUN_ALREADY_ACTIVE` 를 내는
  서버가 없다. 목업으로 흉내 낸 409 로만 확인했다.
- 두 탭에서 동시에 누르는 실제 경합은 만들지 않았다.
