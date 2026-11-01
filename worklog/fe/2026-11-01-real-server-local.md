# 목 대신 실백엔드로 돌려 봤다 (배포는 그대로)

- 브랜치: feat/real-server-local (develop 위)
- 주요파일: frontend/vite.config.ts

## 왜

배포된 화면이 목으로 돈다. 번들을 `VITE_API` 없이 빌드하기 때문이다
(`deploy/web.Dockerfile`). 실서버로 옮기기 전에 **무엇이 실제로 깨지는지**
먼저 재기로 했다. 이번에는 **배포를 바꾸지 않는다** — 로컬 확인까지다.

## 전환 자체는 한 줄이다

이미 다 있다. 내가 만든 것은 없다.

| | |
| :--- | :--- |
| `src/api/http.ts` | 계약 전체 구현 (343줄 + 테스트 302줄) |
| `deploy/Caddyfile` | `/api/v1/*` → `backend:8080`. 같은 오리진이라 CORS 가 없다 |
| 인증 | `{accessToken}` 본문 + httpOnly 리프레시 쿠키 — 백엔드와 모양이 맞는다 |
| `isMock` | 샘플 파일·카카오 버튼·목업 비밀번호 안내가 이미 갈라져 있다 |

남은 것은 `web.Dockerfile` 의 `RUN npm run build` 에 `VITE_API=http` 를
붙이는 것뿐이다. **이번에 하지 않았다.**

## 로컬에 실백엔드를 띄우는 데 세 번 막혔다

`backend/README.md` 대로 하면 누구나 같은 데서 막힌다. 적어 둔다.

### 1. JDK 21 이 필요한데 호스트에 25 만 있었다

`backend/build.gradle` 이 `JavaLanguageVersion.of(21)` 이고 툴체인
자동 내려받기 설정이 없다. `bootRun` 이 `FAILURE: ... 25.0.1` 로 죽는다.

호스트에 JDK 를 깔지 않고 `deploy/backend.Dockerfile` 로 빌드했다.
**배포가 쓰는 바로 그 이미지(`eclipse-temurin:21`)** 라 더 충실하다.

```
docker build -f deploy/backend.Dockerfile -t ktc4-backend:local .
```

### 2. 8080 이 이미 쓰이고 있었다

내 PC 에서는 다른 프로젝트가 잡고 있었다. 18080 으로 내보냈다.
포트를 고정으로 적어 두면 이런 데서 걸린다.

### 3. Flyway 가 「스키마가 비어 있지 않다」로 거부했다

```
FlywayException: Found non-empty schema(s) "public" but no schema history table.
```

루트 `compose.yaml` 의 postgres 가 initdb 로 `db/schema.sql` 을 먼저 넣는다.
그런데 `db/schema.sql` 머리말은 순서를 이렇게 적어 뒀다.

> 1) Flyway (백엔드 부팅 또는 V1 수동 적용) 2) 이 파일 3) 적재 또는 덤프 복원

**compose 는 2번을 1번보다 먼저 한다.** 기존 DB 를 지우지 않고 이력 표만
0 에서 시작하게 해서 V1~V14 를 전부 적용했다.

```
SPRING_FLYWAY_BASELINE_ON_MIGRATE=true
SPRING_FLYWAY_BASELINE_VERSION=0
```

`BASELINE_VERSION` 을 빼면 안 된다. 기본값 1 이라 V1 이 건너뛰어지고,
V1 이 만드는 `statute_version` 이 없어 뒤가 다 무너진다.

## 고친 것 — vite.config.ts 가 .env.local 을 못 읽었다

`VITE_API_TARGET` 으로 프록시 대상을 바꾸게 돼 있는데, 설정 파일이
`process.env` 만 읽었다. **vite 는 .env 파일을 `process.env` 에 올리지 않는다.**

그래서 `.env.local` 에 둘을 적으면

```
VITE_API=http                            ← 화면은 먹는다 (import.meta.env)
VITE_API_TARGET=http://127.0.0.1:18080   ← 프록시는 안 먹는다
```

**화면은 실서버 모드인데 프록시는 배포 서버를 본다.** 로컬을 재는 줄 알고
남의 서버를 재게 된다. 내가 실제로 이걸 당했고, 응답 헤더의 `via: 1.1 Caddy`
로 알아챘다.

`loadEnv` 로 직접 읽게 고쳤다. `process.env` 가 여전히 먼저라 셸에서 주던
방식은 그대로 된다.

## 쟀다 — 로컬 실백엔드, demo@example.com

### 엔드포인트

배포 서버에 바깥에서 찔러 보면 **인증 인터셉터가 모든 경로를 401 로 막아**
있는 것과 없는 것이 구분되지 않는다. 토큰을 들고 재야 한다.

| 경로 | 결과 |
| :--- | :--- |
| `users/me` · `users/me/contexts` · `upload-batches` · `transactions` | 200 |
| `classification-reviews` · `judgments` · `questions` | 200 |
| `users/me/contexts/current` | **404 — 계약대로다**. 문진 전이면 404 고 `http.ts` 가 null 로 바꾼다 |
| `progress` | 400 (batchId 필수) |
| `handoff-notes` | **404 — 서버에 없다** |
| `admin/rule-candidates` | 404 (단, 호출되지 않는다. 아래) |

**404 두 가지가 코드로 구분된다.** 추측이 아니라 실제 응답이다.

```
없는 엔드포인트   {"code":"NOT_FOUND","message":"No static resource api/v1/handoff-notes."}
없는 데이터       {"code":"CONTEXT_NOT_FOUND","message":"문진 전입니다."}
```

### 업로드부터 결과까지 (`backend_api_plan.md` 4단계)

샘플 파일은 목업 모드에서만 보여서, Vite dev 가 TS 를 그대로 서빙하는 것을
이용해 페이지에서 `/src/parser/samples.ts` 를 직접 불러 파일 입력에 넣었다.
앱의 실제 파싱·업로드 경로를 그대로 탔다.

```
POST /auth/login                       200
POST /upload-batches                   201   11건 (13행 중 2행은 보내지 않음)
POST /users/me/contexts                201   버전 1
POST /judgment-runs                    202
GET  /judgment-runs/{id}               200   폴링
GET  /judgments/summary?runId=…        200
GET  /judgment-runs/{id}/failures      200
```

화면도 데이터를 갖고 떴다 — `/results` 가 7건 표와 상세 패널(G2 ·
`RULE_NOT_FOUND` · 근거 조문 없음 · 판정 이력 rev.1 · 수정 버튼)까지,
`/summary` 가 계정과목 빈 상태와 넘길 문장까지.

가맹점 분류도 돌았다. 넷플릭스·구독서비스, 교보문고·도서, 스타벅스·카페,
의료 3건은 가맹점명이 가려진 채로 들어왔다.

### 새로고침하면 로그아웃되던 것이 사라진다

이게 이번 전환의 가장 큰 이득이다. 목의 `restore: () => delay(false)` 때문에
**새로고침하면 무조건 로그아웃**이었고, 배포 번들이 목으로 돌아서 배포된
화면에서도 그랬다.

실백엔드에서는 `POST /auth/refresh` 가 **200** 이고 헤더가 로그인 상태로
돌아온다. #191 과 같은 뿌리일 수 있다.

### 화면별

| 화면 | 결과 |
| :--- | :--- |
| `/upload` | 뜬다. 샘플 파일 목록이 사라진다(`isMock`) |
| `/interview` · `/confirm` | 뜬다. 문진 201 뒤 `/confirm` 이 실데이터를 보여준다 |
| `/run` | 뜬다. **부분 실패를 제대로 보여준다** (아래) |
| `/results` · `/summary` · `/questions` | 뜬다 |
| `/transactions` · `/uploads` · `/preview` | 뜬다 |
| `/account` | 뜬다. `demo@example.com` · 가입일 |
| `/admin` | **들어가지지 않는다** → `/upload` 로 되돌아간다 |
| `/login` | 카카오 버튼 · 샘플 계정 버튼 · 목업 비밀번호 안내가 사라진다 |

## 안 깨지는데 내가 깨진다고 했던 것 — 정정

처음에 `admin/rule-candidates` 와 `handoff-notes` 때문에 두 화면이 깨진다고
적었다. **둘 다 틀렸다.** 엔드포인트 유무만 보고 호출 경로와 구현을 안 봤다.

**`/admin` 은 깨지지 않는다. 못 들어간다.** 실서버 `UserResponse` 는
`id`·`email`·`createdAt` 뿐이고 `role` 이 없다. `isAdmin` 이 false 가 되어
`<Navigate to="/upload">` 로 되돌아가고, AppShell 의 관리자 메뉴도 안 보인다.
**`admin/rule-candidates` 는 애초에 호출되지 않는다.** 관리자 역할이 아직
서버에 없으니 이게 맞는 동작이다.

**`handoff-notes` 도 이미 처리돼 있다.** `http.ts` 가 404 를 빈 배열로 바꾼다.

```ts
// 저장 API 가 아직 없는 서버(404)는 저장한 질문이 없는 것과 같다
list: () => get('/handoff-notes').catch((caught) => {
  if (caught instanceof ApiRequestError && caught.status === 404) return [];
  throw caught;
}),
```

`/summary` 의 넘길 문장에 `(불러오지 못해 빠진 항목: 따로 물을 질문)` 이
**붙지 않는 것으로** 확인했다. 404 가 흡수돼 출력에 끼지 않는다.

그래서 **「빈 상태로 떨어뜨리는」 작업은 할 것이 없었다.** 코드를 고치는
대신 이미 맞는지 확인한 것이 이번 결과다.

## 계약 주석이 낡았다

`contract.ts` 가 「중계·진행 상황·세무대리인 질문 API 는 아직 백엔드 일정에
없다」고 적어 뒀는데, `progress` 와 `assistant/chat` 은 컨트롤러가 생겼다.
안 생긴 것은 `handoff-notes` 뿐이다. 그리고 **`handoff-notes` 는 `docs/`
어디에도 없다** — api.md 에도 없다. 계약 없이 프론트가 먼저 가정한 경로다.

## 확인하지 못한 것 — 여기가 선이다

**판정 내용은 재지 못했다.** 7건이 모두 「확인 필요」로 떨어지고 1건은
백엔드에서 실패했다.

```
IllegalStateException: Expected one effective statute version for 소득세법-33-1-5
```

**제품 버그가 아니라 내 로컬 환경이다.** 조문 코퍼스를 적재하지 않았다 —
`db/schema.sql` 이 적어 둔 3단계 중 3번이다. 적재에는 국가법령정보
OPEN API 키(`LAW_API_OC`)가 필요해서 하지 않았다. 없는 키를 지어내거나
`statute_version` 행을 손으로 넣지 않았다. 넣으면 판정 결과가 근거 없는
숫자가 된다.

그래서 **「가능」·「불가」 판정이 붙은 화면과 조문 근거가 붙은 상세 패널은
확인하지 못했다.** 빈 상태와 「확인 필요」만 봤다.

`/run` 이 부분 실패를 제대로 보여주는 것은 덤으로 확인됐다 — 실패 거래
1건과 금액, 「다시 판정하기」까지 나온다.

비서(`/assistant/chat`)도 확인하지 못했다. compose 의 `ai` 서비스를
띄우지 않았다.

## 배포로 넘기기 전에 정해야 할 것

**로그인 문턱이 막힌다.** `FixedUserCredentialVerifier` 가
`demo@example.com` 하나만 통과시키고 회원가입 엔드포인트가 없다(#177 열림).
비밀번호는 `APP_AUTH_DEMO_PASSWORD` 고 비면 아무도 못 들어간다.

지금 배포 화면에는 「샘플 계정으로 둘러보기」가 있어 아무나 들어온다.
**실서버로 켜면 그 버튼이 `isMock` 으로 사라지고, 비밀번호를 아는 사람만
들어온다.** 이걸 정하지 않고 켜면 안 된다.

## 이번에 건드리지 않은 것

- `deploy/web.Dockerfile` — 배포는 그대로 목이다
- `handoff-notes`·`admin` 관련 화면 코드 — 고칠 것이 없었다
- 조문 코퍼스 적재 — 키가 필요하다
