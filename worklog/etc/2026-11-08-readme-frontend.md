# README 실행 절의 Frontend 칸

- 브랜치: feature/readme
- 주요파일: README.md

## 한 일

- `### 파트별 실행` 의 `#### Frontend` 칸(`✏️ 작성 필요`)을 채웠다. #257 의 TODO 주석대로 핵심 명령과 `frontend/README.md` 링크를 넣고 주석은 지웠다.
- 적은 것: 필요한 것(Node 22, npm), 명령 네 줄(`npm install`, `dev`, `build`, `test && lint`), 환경 변수 표 세 줄, 상세 문서 링크 두 개.

## 왜 이렇게 했나

- 같은 절의 Backend·AI 칸이 「한 줄 설명 → 명령 블록 → 환경 변수 표 → 상세 문서 링크」 모양이라 그대로 따랐다. 환경 변수는 위 `환경 변수` 절에도 산문으로 있지만, Backend 칸도 같은 값을 표로 한 번 더 두고 있다.
- Node 버전은 `.github/workflows/aws-release.yml:54` 의 `node-version: "22"` 를 적었다. `frontend/package.json` 에 `engines` 가 없어 저장소에서 버전을 말하는 곳은 CI 뿐이다.
- 환경 변수는 `import.meta.env` 를 실제로 읽는 세 개(`VITE_API`, `VITE_API_TARGET`, `VITE_KAKAO_REST_API_KEY`)만 뒀다. 나머지 `VITE_*` 는 코드에서 읽는 곳이 없다.
- `VITE_API_TARGET` 의 기본값은 `frontend/vite.config.ts` 의 `'https://ktc4-pusan-4.duckdns.org'` 를 그대로 적었다. 「배포 서버」만 적으면 로컬을 볼 줄 알고 딴 서버를 재게 된다 — 같은 이유가 그 파일 주석에도 있다.
- 포트는 `vite.config.ts` 에 `server.port` 가 없어 Vite 기본값 5173 이다. `frontend/README.md` 도 같은 값을 적고 있다.
- 「CI 는 build · test · lint 를 돌린다」 는 한 줄은 명령 네 개 가운데 어느 것이 관문인지 알려 주려고 넣었다. `npm run check:tokens` 는 CI 에 없어서 적지 않았다.

## 확인한 것

- `cd frontend && npm test` — 190 통과, 7 건너뜀(파일 1개), 실패 0.
- `#257` 의 `✏️ 작성 필요` 는 이 칸이 마지막이었다. 나머지 다섯 칸은 다른 파트가 채웠다.

## 남은 것 · 아는 문제

- `frontend/README.md` 의 「데이터 흐름」 절이 아직 「`src/api/index.ts` 가 지금은 mock 구현을 내보내고, 백엔드가 준비되면 여기서 http 구현으로 바꾼다」 로 되어 있다. 지금은 `VITE_API` 로 갈라서 둘 다 쓴다. 이 PR 범위가 아니라 두었다.
