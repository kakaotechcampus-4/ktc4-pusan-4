![PreeT Banner](./docs/img/readme/banner.png)

<div align="center">

### 1인 개인사업자를 위한 종합소득세 경비 판정 서비스

> **카드 승인내역만 올리면, 지출 한 건마다 필요경비로 인정되는지 조문 근거와 함께 알려 드립니다.**

**"AI가 규칙을 만들고, 규칙이 판정한다."**

[🌐 서비스 바로가기](https://ktc4-pusan-4.duckdns.org)

---

### 💡 왜 PreeT인가?

|       핵심 가치       | 설명                                                                                   |
| :-------------------: | -------------------------------------------------------------------------------------- |
|   **근거 있는 판정**   | 판정마다 소득세법 조문을 붙여, "왜 되고 왜 안 되는지"를 사용자가 직접 확인할 수 있습니다 |
| **판정 경로에 LLM 없음** | 판정은 결정론적 규칙 엔진이 합니다. 같은 입력이면 언제나 같은 결과가 나옵니다           |
|  **세무사와 함께 쓰는 도구** | 세무사를 대체하지 않습니다. 애매한 건은 확인필요로 남기고, 넘길 자료를 정리해 드립니다    |

---

**개발 기간**: 2026년 9월 ~ 2026년 11월 · 카카오테크 캠퍼스 4기 부산대 4팀

</div>

---

## 목차

<table>
<tr>
<td width="50%">

### 📋 프로젝트 정보

- **[주요 기능](#주요-기능)**
- **[아키텍처](#아키텍처)**
- **[기술 스택](#기술-스택)**
- **[디렉터리 구조](#디렉터리-구조)**

</td>
<td width="50%">

### 🤝 협업 가이드

- **[Git 규칙](#git-규칙)**
- **[코드 컨벤션](#코드-컨벤션)**
- **[실행 · 배포](#실행--배포)**
- **[팀원](#팀원)**

</td>
</tr>
</table>

---

## 주요 기능

### 1. 카드 내역 업로드 & AI 업종 분류

> **카드 승인내역 업로드**
> KB국민 · IBK기업 카드사에서 받은 승인내역 파일을 그대로 올립니다. 원본 파일은 서버로 보내지 않고 브라우저에서 읽습니다

> **AI 분류 후보**
> 규칙으로 업종을 정하지 못한 가맹점은 AI가 후보를 최대 3개 추천하고, 확정은 사용자가 합니다

<!-- TODO: 스크린샷/GIF -->
<p align="center"><img src="./docs/img/readme/upload.gif" width="80%" alt="업로드" /></p>

<br/>

### 2. 규칙 엔진 판정 & 되묻기

> **조문 근거와 함께 판정**
> 가능 · 불가 · 확인필요 세 가지로 판정하고, 근거 조문을 붙입니다

> **필요한 것만 되묻기**
> 주말 식대, 자택 겸용 경비처럼 사실 확인이 필요한 건만 짧게 질문합니다

<p align="center"><img src="./docs/img/readme/judge.gif" width="80%" alt="판정" /></p>

<br/>

### 3. 결과 요약 & 세무사용 내보내기

> **한도·자산 반영**
> 접대비 연 한도 초과액, 100만원 초과 자산의 감가상각까지 반영한 금액을 보여 줍니다

> **CSV 내려받기**
> 세무사에게 그대로 넘길 수 있는 형태로 내보냅니다

<p align="center"><img src="./docs/img/readme/summary.gif" width="80%" alt="결과 요약" /></p>

<br/>

### 4. AI 비서 Really

> **판정 결과 설명**
> "이건 왜 안 돼요?" 같은 질문에 내 판정 결과와 조문을 바탕으로 답합니다

> **프롬프트 인젝션 방어**
> 6가지 공격 유형을 직접 시험해 막았습니다 ([보고서](docs/really-prompt-injection-report.md))

<p align="center"><img src="./docs/img/readme/really.gif" width="80%" alt="Really" /></p>

<br/>

### 5. 규칙 후보 자동 승격

> **AI가 규칙 카드 초안 작성 → 관리자 승인 → 자동 PR**
> 승인된 후보를 규칙 카드 파일로 만들어 매주 develop에 PR을 올립니다

---

## 아키텍처

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/img/readme/architecture-dark.gif" />
  <img src="./docs/img/readme/architecture.gif" alt="PreeT 시스템 아키텍처" />
</picture>

> **판정 흐름**
> 카드내역 → 정규화 → AI 업종 분류(판정 전 단계) → 규칙 엔진 `judge()` → 판정 + 조문 근거

### 구성 요소별 역할

> **Caddy**
> HTTPS를 처리하고, `/api/v1` 요청은 API 서버로, 나머지는 빌드된 웹 화면으로 보냅니다

> **API 서버 (Spring Boot)**
> 업로드 · 판정 · 되묻기 · 요약 · 내보내기 API를 제공합니다. 규칙 엔진이 `rules/cards/*.yaml` 규칙 카드로 판정합니다

> **AI 서버 (FastAPI)**
> 규칙으로 업종을 정하지 못한 가맹점의 분류 후보를 추천하고, AI 비서 Really의 답변을 만듭니다

> **PostgreSQL · Redis**
> 거래 · 판정 · 규칙 후보는 PostgreSQL에, 로그인 토큰 · 이메일 인증 · 비서 사용량 제한은 Redis에 둡니다

> **주간 배치 (systemd timer)**
> 관리자가 승인한 규칙 후보를 카드 파일로 바꿔 develop에 PR을 올리고, 결과를 디스코드로 알립니다

---

## 기술 스택

| 분류 | 기술 |
| --- | --- |
| **Frontend** | ![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white) ![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white) |
| **Backend** | ![Java](https://img.shields.io/badge/Java_21-007396?style=for-the-badge&logo=openjdk&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring_Boot_3.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white) ![Flyway](https://img.shields.io/badge/Flyway-CC0200?style=for-the-badge&logo=flyway&logoColor=white) |
| **AI** | ![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![uv](https://img.shields.io/badge/uv-DE5FE9?style=for-the-badge&logo=uv&logoColor=white) ![Langfuse](https://img.shields.io/badge/Langfuse-0A0A0A?style=for-the-badge&logoColor=white) |
| **DB** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![pgvector](https://img.shields.io/badge/pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white) ![pg_bigm](https://img.shields.io/badge/pg__bigm-336791?style=for-the-badge&logo=postgresql&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) |
| **Infra** | ![AWS](https://img.shields.io/badge/AWS_EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) ![Caddy](https://img.shields.io/badge/Caddy-1F88C0?style=for-the-badge&logo=caddy&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white) |

---

## 디렉터리 구조

```
.
├─ frontend/   React + Vite 웹
├─ backend/    Spring Boot API · 규칙 엔진
├─ ai/         FastAPI AI 서버 (업종 분류 · Really)
├─ rules/      규칙 카드 (cards/*.yaml)
├─ eval/       판정 평가셋
├─ deploy/     배포 스크립트 · systemd 타이머
├─ docs/       설계 문서
└─ worklog/    작업 기록
```

---

## Git 규칙

<table>
<tr>
<td width="50%" valign="top">

#### 브랜치

| 브랜치 | 용도 |
| --- | --- |
| `main` | 멘토 리뷰 대상 |
| `develop` | 기본 브랜치 |
| `release` | AWS 자동 배포 |
| `feature/*` | 기능 작업 |
| `refactor/*` | 멘토 리뷰 반영 |

</td>
<td width="50%" valign="top">

#### 커밋 메시지

```
<type>: <subject>
```

```
feat: G6 한도 버킷 판정 추가
fix: 카드사 CSV 헤더 공백 처리
```

전체 type 목록은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

</td>
</tr>
</table>

### Pull Request

<table>
<tr>
<td width="50%" valign="top">

#### 리뷰 규칙

- `feature/*` → `develop` 으로 PR을 올립니다
- 팀원 1명 이상 리뷰 후 PM이 머지합니다
- 매주 `develop` → `main` PR로 멘토 리뷰를 받습니다

</td>
<td width="50%" valign="top">

#### 본문 템플릿

```markdown
## 이번에 한 일
## 리뷰에서 봐주셨으면 하는 곳
## 고민했던 점 · 다른 선택지
## 지난 리뷰 반영 (재리뷰 요청일 때만)
```

</td>
</tr>
</table>

---

## 코드 컨벤션

| 파트 | 도구 | 역할 |
| --- | --- | --- |
| **Frontend** | ESLint | 코드 린팅 |
| **Backend** | PMD · CPD | 정적 분석 · 중복 코드 검사 (CI) |
| **AI** | Ruff · pytest | 린팅 · 테스트 (CI) |
| **공통** | worklog pre-push 훅 | 코드를 push 할 때 `worklog/` 작업 기록을 함께 남깁니다 |

---

## 실행 · 배포

### 빠른 시작

루트 `compose.yaml` 은 PostgreSQL · Redis · AI 서버를 띄웁니다. Backend · Frontend 는 [파트별 실행](#파트별-실행)으로 따로 띄웁니다.

```bash
git clone https://github.com/kakaotechcampus-4/ktc4-pusan-4.git && cd ktc4-pusan-4
cp .env.example .env    # LLM 키는 비워도 서버는 뜹니다
docker compose up -d    # PostgreSQL(15432) · Redis(16379) · AI 서버(8000)
```

> compose 로 띄운 AI 서버에는 `CLASSIFY_*` 가 넘어가지 않아 업종 분류가 503 으로 답합니다. 분류까지 보려면 AI 서버를 아래처럼 직접 띄웁니다

### 환경 변수

<!-- TODO(@yuyeol3): 필요한 .env 항목과 예시 파일 위치 -->
> ✏️ 작성 필요

### 파트별 실행

#### Backend

<!-- TODO(@yuyeol3 @memoryhong): 핵심 명령 한두 줄. 자세한 내용은 backend/README.md 링크 -->
> ✏️ 작성 필요

#### Frontend

<!-- TODO(@cho104 @Jaeseong22): 핵심 명령 한두 줄. 자세한 내용은 frontend/README.md 링크 -->
> ✏️ 작성 필요

#### AI

루트 `.env` 를 읽습니다. 키가 없는 기능은 꺼진 채로 뜹니다.

```bash
cd ai
uv sync
uv run uvicorn app.main:app --reload --port 8000   # 확인: curl localhost:8000/health
uv run ruff check . && uv run pytest               # CI 와 같은 검사
```

| 환경 변수 | 기능 | 비우면 |
| --- | --- | --- |
| `ASSISTANT_*` | AI 비서 Really | 안내 문구로만 답함 |
| `CLASSIFY_*` | 가맹점 업종 분류 | 503 |
| `AGENT_*` · `EMBEDDING_*` · `LAW_API_OC` | 규칙 후보 파이프라인 · 조문 검색 | 배치 실패 |
| `LANGFUSE_*` | LLM 호출 추적 | 꺼짐 |

주간 배치는 직접 돌려 볼 수 있습니다: `uv run python -m pipeline.candidates --dry-run`, `uv run python -m pipeline.promote --dry-run`

### 배포

<!-- TODO(@memoryhong @yuyeol3): develop → release 자동 배포 흐름 요약. 자세한 내용은 docs/deployment.md 링크 -->
> ✏️ 작성 필요

---

## 팀원

<table align="center">
  <tr>
    <td align="center"><a href="https://github.com/IwanttobeaHokage"><img src="https://avatars.githubusercontent.com/u/211453122?v=4" width="100px" alt="정현빈"/><br/><sub><b>정현빈</b></sub></a><br/>PM</td>
    <td align="center"><a href="https://github.com/yuyeol3"><img src="https://avatars.githubusercontent.com/u/102399989?v=4" width="100px" alt="최유렬"/><br/><sub><b>최유렬</b></sub></a><br/>BE 리드</td>
    <td align="center"><a href="https://github.com/RainDrop3"><img src="https://avatars.githubusercontent.com/u/110617720?v=4" width="100px" alt="강민규"/><br/><sub><b>강민규</b></sub></a><br/>AI 리드</td>
    <td align="center"><a href="https://github.com/cho104"><img src="https://avatars.githubusercontent.com/u/139591327?v=4" width="100px" alt="이치오"/><br/><sub><b>이치오</b></sub></a><br/>FE 리드</td>
    <td align="center"><a href="https://github.com/memoryhong"><img src="https://avatars.githubusercontent.com/u/166277696?v=4" width="100px" alt="홍성진"/><br/><sub><b>홍성진</b></sub></a><br/>BE · 플래너</td>
    <td align="center"><a href="https://github.com/Jaeseong22"><img src="https://avatars.githubusercontent.com/u/170401002?v=4" width="100px" alt="이재성"/><br/><sub><b>이재성</b></sub></a><br/>FE · 메이커</td>
  </tr>
</table>
