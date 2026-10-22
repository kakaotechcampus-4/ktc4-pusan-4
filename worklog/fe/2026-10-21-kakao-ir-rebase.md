# 디자인 브랜치를 지금 develop 위로 다시 올렸다

- 브랜치: design/kakao-ir (#151)
- 이어지는 문서: `2026-10-17-kakao-ir-design.md`
- 주요파일: frontend/src/components/AppShell.tsx, frontend/src/components/MarketingHeader.tsx, frontend/src/pages/{Interview,Login,Questions,Results}.tsx

## 한 일

#138·#140·#142·#143 이 머지되면서 #151 이 충돌 상태가 됐다. 지금 develop 위로
다시 올리고 충돌 6건을 풀었다. 디자인 변경 내용 자체는 바뀐 것이 없다.

## 왜 충돌이 22개나 났나

평범한 충돌이 아니었다. 머지 베이스가 `ddf1603`(card-parser 시절)까지 밀려
있었고, `assistant/*`·`http.test.ts` 등 7개가 `AA`(양쪽에서 추가)로 떴다.

```
git merge-base --is-ancestor origin/feature/assistant-panel origin/develop
  → 아님
```

스택이 머지 전에 리베이스(강제 푸시)돼서, develop 에는 같은 **내용**이 다른
**커밋**으로 들어갔다. 이 브랜치는 옛 커밋 위에 있어서, git 이 공통 조상을 한참
뒤로 잡고 같은 파일을 서로 다른 쪽에서 새로 만든 것으로 봤다.

그래서 22건 중 16건은 내용이 같은데 이력만 갈린 가짜 충돌이었다.

## 어떻게 풀었나

머지하지 않고 **디자인 변경분만 지금 develop 위에 다시 붙였다.**

```
git diff origin/feature/assistant-panel..design/kakao-ir > design.patch
git checkout -b tmp/reapply origin/develop
git apply --3way design.patch
```

충돌이 22건에서 6건으로 줄었다. 남은 6건은 전부 같은 모양이었다 — 치오님이
문구·로직을 바꾼 줄에서 내가 굵기 클래스를 바꿔 겹쳤다.

- `Interview`·`Login`·`Questions`·`Results`: 내 변경이 굵기 치환뿐이라
  손으로 합치지 않고 develop 쪽을 통째로 가져온 뒤 치환만 다시 돌렸다
  (`git checkout --ours` → `sed 's/font-semibold/font-bold/g'`)
- `AppShell`: develop 의 `refs`(#142 에서 상수 `REFS` 가 권한별 변수로 바뀌었다)
  를 쓰고 내 `gap-1.5` 를 남겼다
- `MarketingHeader`: develop 의 `status === 'restoring'` 분기를 쓰고 내
  `shrink-0`·`whitespace-nowrap` 을 남겼다

앞의 네 개를 손으로 합쳤으면 문구를 되돌릴 뻔했다. 예를 들어 `Questions` 는
「질문이 걸린 금액」이 「확인 필요 N건 · 금액」으로 바뀌어 있었다.

## 왜 이력을 눌렀나

`git rebase --onto origin/develop origin/feature/assistant-panel` 로 커밋 6개를
살리려 했는데 첫 커밋부터 같은 충돌이 났다. 여섯 번 반복하면 이미 검증을 마친
트리와 어긋날 수 있어 접고, 검증한 트리를 커밋 하나로 올렸다. 원래 커밋 6개가
무엇이었는지는 PR 본문과 위 문서에 남아 있다.

## 확인

- `npx tsc --noEmit` 오류 0
- `npm test` **153개 통과** (131개 → develop 에서 테스트가 합류했다)
- `npm run build` 통과 · `npm run lint` 오류 0 (경고 10건은 기존 파일)
- `npm run check:tokens` 전부 일치
- 랜딩과 로그인 화면을 띄워 확인했다. 로그인 화면의 목 비밀번호 안내(#142)가
  새 디자인으로 들어와 있다

## 남은 것

- 강제 푸시라 #151 의 승인이 풀릴 수 있다
- 레퍼런스 재무제표 화면의 왼쪽 레일은 여전히 안 가져왔다
- `Interview.tsx` 의 생 px 글자 크기 15곳은 그대로다
