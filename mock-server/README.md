# mock-server

`docs/api.md` REST 계약을 얕은 인메모리 로직으로 구현한 NestJS mock 서버. API 테스트용이며, 실제 판정 로직은 흉내만 낸다 — 무엇을 어떻게 단순화했는지는 [`docs/api-mock-implementation.md`](../docs/api-mock-implementation.md)에 정리되어 있다.

## 실행

```bash
npm install
npm run dev   # http://localhost:4000, watch 모드
```

- 모든 API는 `/api/v1` 아래에 있다.
- `Authorization: Bearer <아무 값>` 헤더가 없으면 401을 반환한다 (실제 토큰 검증은 하지 않는다).
- Swagger UI: `http://localhost:4000/docs`
- 서버 부팅 시 업로드 없이 바로 탐색 가능한 배치 하나가 시딩된다 (`src/seed/seed-data.ts`).
- 데이터는 모두 인메모리라 서버를 재시작하면 초기화된다.

## 스크립트

- `npm test` — 빌드 후 Node 내장 테스트 실행
- `npm run dev` — watch 모드로 기동
- `npm run build` — `dist/`로 빌드
- `npm run start` — 빌드된 결과 실행
