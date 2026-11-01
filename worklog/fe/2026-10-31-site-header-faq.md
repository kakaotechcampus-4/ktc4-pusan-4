# 헤더 메뉴를 페이지로 바꾸고 FAQ 를 만들었다

- 브랜치: feat/site-header (feat/rename-preet 위에 쌓았다)
- 주요파일: frontend/src/components/MarketingHeader.tsx, frontend/src/pages/Faq.tsx,
  frontend/src/mock/faq.ts, frontend/src/App.tsx, frontend/src/pages/{Landing,Login}.tsx

## 한 일

### 1. 헤더 메뉴

랜딩 안 앵커 4개(`#system`·`#flow`·`#evidence`·`#scope`)를 뺐다. **랜딩 본문
섹션은 그대로 둔다** — 메뉴에서만 빠지고 스크롤하면 그대로 보인다.

| | 비로그인 | 로그인 |
| :--- | :--- | :--- |
| 왼쪽 | FAQ | FAQ |
| 오른쪽 | 로그인 · 회원가입 | 내 판정으로 · 마이페이지 · 로그아웃 |

「무료로 시작하기」를 「회원가입」으로 바꿨다. 회원가입 화면이 따로 없어
둘 다 `/login` 으로 간다.

### 2. FAQ 페이지 (`/faq`)

여닫이는 `<details>`/`<summary>` 를 그대로 쓴다. 키보드·스크린리더 동작이
브라우저에 이미 있어서, 직접 만들면 그만큼 잃는다.

문구는 `src/mock/faq.ts` 에 뒀다. **답은 서비스가 실제로 한다고 적힌 것에서만
가져왔다** — `marketing.ts` 의 SYSTEM_FEATURES·NOT_DOING·FLOW_STEPS 와
`docs/api.md`(0.4 NEEDS_REVIEW, 2.10 카드사)다. 지어낸 답은 없다.

### 3. 로그인 뒤 메인으로

`Login.tsx` 의 기본 목적지를 `/upload` → `/` 로 바꿨다. 보호 화면에서 튕겨 온
경우(`state.from`)는 원래 가려던 곳을 그대로 지킨다.

### 4. 랜딩 CTA 를 로그인 상태에 맞췄다

**3번만 하면 막힌다.** 로그인한 사람이 메인에 오는데 히어로 CTA 와 알약 CTA 가
`/login` 으로 가서, 로그인한 사람이 로그인 폼을 다시 본다.

둘 다 로그인 상태면 `/upload` 로 보내고, 히어로 문구는 「카드내역 올리기」로
바꾼다. 본문 BOARDS 링크들은 원래 보호 라우트라 그대로 두면 된다.

## 좁은 폭에서 두 번 깨졌다

둘 다 눈이 아니라 `scrollWidth - clientWidth` 로 쟀다.

1. **로그인 상태에서 헤더가 37px 넘쳤다.** 버튼이 셋이라 375px 에 안 들어간다.
   → 「내 판정으로」를 `hidden sm:inline-flex` 로 접었다. 바로 아래 히어로에
   같은 자리로 가는 CTA 가 있다
2. **「자주 묻는 질문」이 "자주 묻 / 는 질문" 으로 꺾였다.** 한글이 음절 단위로
   끊긴다. → 라벨을 `FAQ` 로 줄이고 `whitespace-nowrap` 을 걸었다. 페이지 안
   제목은 「자주 묻는 질문」 그대로다

처음엔 메뉴를 `hidden sm:block` 으로 뒀는데, **그러면 모바일에서 FAQ 로 갈 길이
없다.** 푸터에도 FAQ 링크가 없다. 좁은 폭에서도 남기기로 했다.

## 확인

- `npx tsc --noEmit` 오류 0 · `npm run check:tokens` 전부 일치
- `npm test` **158개 통과** · `npm run build` 통과
- `npm run lint` 오류 0 (경고 10건은 기존 파일)
- 브라우저에서 직접 눌러 봤다
  - `/faq` 가 뜨고 질문을 누르면 답이 펼쳐진다
  - 샘플 계정으로 로그인하면 `/` 로 온다 (전에는 `/upload`)
  - 로그인하면 히어로 CTA 가 「카드내역 올리기」로 바뀐다
  - 로그아웃을 누르면 헤더가 로그인·회원가입으로 돌아가고 localStorage 가 빈다
  - 375px 에서 로그인·비로그인 양쪽 다 오버플로 0

## 왜 rename 위에 쌓았나

`MarketingHeader.tsx` 를 통째로 다시 써서 #206(이름 변경)과 같은 파일을 전부
건드린다. develop 기준으로 두면 충돌하거나 한쪽이 조용히 덮인다. #206 이
머지되면 리베이스하면 된다.

## 하지 않은 것

- **버그 신고.** 치오님이 맡기로 했다. 메뉴에도 아직 넣지 않았다
- **앱 헤더(AppShell) 통합.** 12개 페이지가 쓰고 진행 단계·자료 링크가 그 안에
  있다. 「헤더는 하나로, 단계는 아래 띠로」로 방향은 정했지만 이번엔 메인
  페이지만 보기로 했다
- 로고 옆 「판정 안내」 라벨을 뺐다. 앵커 메뉴와 한 세트였는데 메뉴가 페이지로
  가면서 뜻이 흐려졌다
- 회원가입이 아직 `/login` 과 같은 화면이다
