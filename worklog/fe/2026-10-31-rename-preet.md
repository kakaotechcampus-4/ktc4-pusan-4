# 서비스 이름을 PreeT 로 바꿨다

- 브랜치: feat/rename-preet
- 주요파일: frontend/index.html, frontend/src/components/{AppShell,MarketingHeader,MarketingFooter}.tsx,
  frontend/src/pages/{Landing,Login,Styleguide}.tsx

## 한 일

화면에 보이는 이름을 `경비판정` → `PreeT` 로 바꿨다. 코드 13곳, 문서 2곳.

- 로고 글자: `AppShell` · `MarketingHeader` · `MarketingFooter` · `Login`(2곳)
- `aria-label="경비판정 홈"` 4곳
- 푸터 저작권 줄
- 랜딩 섹션 제목 2개
- 스타일가이드 제목
- `README.md` · `DESIGN.md` 첫 줄

## 조사는 '가' 다

`경비판정이 지키는 것` → **`PreeT가 지키는 것`**.

「프리티」로 읽기로 해서 모음으로 끝난다. 자음으로 끝나는 `경비판정` 의 조사를
그대로 두면 `PreeT이` 가 되어 틀린다. **라틴 문자 뒤의 조사는 철자가 아니라
발음을 따른다.** 앞으로 이름이 들어가는 문장을 쓸 때 같이 봐야 한다.

## 바꾸지 않은 것

`1인 IT 개발 사업자를 위한 경비 판정`(랜딩 히어로 윗줄)은 그대로 두었다.
여기서 **「경비 판정」은 브랜드명이 아니라 무엇을 하는지 설명하는 일반어**다.
붙여쓴 `경비판정`(브랜드)과 띄어쓴 `경비 판정`(일반어)을 갈라서 치환했다.

## 겸사겸사 — lang 속성

`index.html` 의 `<html lang="en">` 을 `"ko"` 로 고쳤다. 한국어 페이지인데 영어로
선언돼 있어 스크린리더가 영어 음성으로 읽는다. `<title>` 을 고치는 김에
바로 윗줄이라 같이 처리했다.

## 확인

- `npx tsc --noEmit` 오류 0 · `npm run check:tokens` 전부 일치
- `npm test` **158개 통과** · `npm run build` 통과
- `npm run lint` 오류 0 (경고 10건은 기존 파일)
- 랜딩·로그인을 띄워 확인했다. 탭 제목이 `PreeT`, `document.documentElement.lang`
  이 `ko`, 제목 두 개가 `PreeT 주요현황` · `PreeT가 지키는 것` 으로 나온다
- 목·테스트에는 이름이 박혀 있지 않아 고칠 것이 없었다

## 찾았지만 고치지 않은 것

**로그인 왼쪽 패널 로고의 세 번째 막대가 안 보인다.** 계산된 색으로 확인했다.

```
패널 배경  rgb(10, 10, 10)   (bg-ink)
막대 1·2   rgb(255, 255, 255)
막대 3     rgb(10, 10, 10)   (bg-accent — 배경과 같은 값)
```

마케팅 헤더에서는 세 번째가 `bg-highlight`(노랑)인데 여기만 `bg-accent` 다.
`accent.DEFAULT` 와 `ink` 가 같은 값이라 묻힌다. 이번 변경과 무관한 기존
버그이고 로고는 현빈님이 맡기로 해서 손대지 않았다.
