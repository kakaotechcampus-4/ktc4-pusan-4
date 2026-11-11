# 온보딩 문서 개발 가이드 정리: 그림, ERD, CI

- 브랜치: feature/onboarding-docs
- 커밋: ee7dbf16..3b3c4f92 (7개)
- 주요파일: docs/site/index.html

## 한 일

개발 가이드 페이지를 차례로 손봤다.

- 판정로직(6관문) · 아키텍처
  - 6관문 코드 블록을 6관문 그림으로 바꾸고, 아래에 아키텍처 그림(`docs/img/readme/architecture-hd.png` 와 같은 파일)을 넣었다.
  - 페이지 이름을 「판정로직(6관문) · 아키텍처」로 바꿨다.
- 그림 확대: `.diagram` 그림을 누르면 화면 크기로 띄운다. 띄운 그림을 다시 누르면 원본 크기로 보고 스크롤로 옮긴다. 바깥을 누르거나 Esc 로 닫는다.
- 배포
  - 배포 흐름 코드 블록을 `cicd.png` 로 바꿨다. 그림에 없는 release PR 조건(develop 에서만, 승인 1명, backend · ai · web · release-source)과 Flyway → `schema.sql` · `rag.sql` 순서는 그림 아래 문단으로 남겼다.
  - 구성에 backend · ai 가 blue · green 두 쌍이라는 줄을 더했다.
  - 「검색 노출」을 「SEO」로 바꾸고 프리렌더, 크롤러 파일, Caddy, 접근 기록, 검색 도구 등록(서치콘솔 · Bing · IndexNow · 네이버), 검색 결과 캡처를 적었다. 내용은 `docs/deployment.md` 13절과 운영 서버 응답으로 확인했다. 압축 수치는 11-10 운영 실측(JS 407KB → 127KB)이다.
- em-dash(—) 20개를 파일 전체에서 없앴다. 문장에 맞게 콜론, 마침표, 괄호로 바꿨다.
- 기술 스택
  - 표에서 부가설명을 빼고 기술 이름만 남겼다. Langfuse 는 모니터링으로 옮기고 LLM 에 GPT-6 Luna 를 적었다(`ai/app/config.py` 기본값).
  - 「선정 근거」를 「AI 도구 선정 근거」로 바꿨다. LangGraph 는 쓰지 않음(❌)으로 고치고 이유는 `docs/agent-secretary.md` 7장에서 가져왔다.
  - 디렉터리 표를 HTML/CSS 트리 그림으로 바꾸고 `.claude/`, `.githooks/`, `.github/`, `docker/`, `seeds/`, `CONTRIBUTING.md`, `CLAUDE.md` 를 더했다.
- API: 리소스 구조 코드 블록을 SVG 그림으로 바꿨다(`docs/api.md` 0.1 · 0.3절 기준).
- DB 스키마
  - 「테이블 (24개)」를 「ERD」로 바꾸고 테크스펙의 판정 코어 ERD 그림과 테이블 역할 표 두 개(판정 코어 14개, 학습 루프 · 참조 11개)를 넣었다. 역할 설명은 마이그레이션 DDL 과 코드로 확인했다.
  - 「지킬 것」을 「팀 협의사항」으로 바꿨다. Flyway 마이그레이션 수를 21개에서 23개로 고쳤다.
- 프론트엔드의 「검색 노출」은 SEO 와 겹쳐 지웠다. 「공개 페이지를 더하면 `PAGES` 에 넣는다」만 SEO 프리렌더 행으로 옮겼다.
- 테스트
  - CI → 로컬에서 돌리기 → 판정 평가셋 → 모델 평가(CI 밖) 순서로 다시 짰다.
  - 로컬 표는 프론트 · 백엔드 · AI 를 한 표로 합치고 CI 칸(✓/–)을 뒀다. 프론트 빌드 검사, `check:tokens`, 모델 평가 하네스 3개(`ai/eval/run_*.py`)를 더했다.
  - 백엔드 명령을 루트에서 도는 `./backend/gradlew` 로 고쳤다. `check` 는 PMD 리포트까지 만드는 로컬용이라 표 밖 한 줄로 옮겼다.
- 로컬 실행
  - 프론트엔드 → 백엔드 → AI 서버 순서로 바꾸고, AI 서버 실행(루트 README 의 uvicorn 명령)과 환경 변수 표를 더했다. 테스트 섹션과 겹치던 테스트 표는 지웠다.
  - 코드 블록에 bash 강조를 넣었다(`<code class="bash">` 만). PowerShell 명령은 bash 블록 밖 한 줄로 뺐다.
- 코드 글꼴을 `ui-monospace, SFMono-Regular, Consolas` 로 지정했다. 한국어 Windows 기본 고정폭 글꼴이 역슬래시를 ₩ 로 그렸다.
- 여러 페이지 끝의 출처 · 참고 줄을 지웠다.

## 왜 이렇게 했나

- 이미지는 기존처럼 HTML 안에 base64 로 넣었다. 파일 하나만 있어도, htmlpreview 에서도 보이게 하려던 기존 결정을 따랐다. 무손실 WebP 로 바꿔 크기를 줄였다(6관문 · 아키텍처 557KB → 208KB).
- 디렉터리 트리와 API 리소스 구조는 이미지 파일 대신 페이지 안에 그렸다. 글자가 선명하고 나중에 텍스트로 고칠 수 있다.
- ERD 는 원본 글씨가 16px 정도라 화면 크기 확대로도 6~7px 이었다. 그래서 확대 화면에 원본 크기 보기를 더했다.
- bash 강조는 외부 라이브러리 대신 페이지 안 함수로 했다. htmlpreview 가 외부 스크립트를 불러오는지 확인하지 못했다.
- 테스트 표를 CI 아래에 넣지 않은 것: 프론트는 전용 워크플로가 없지만 AWS release 의 web 단계에서 검사된다. 모듈 표를 CI 아래에 두면 CI 에서 안 도는 명령(`check:tokens` 등)도 CI 것처럼 읽힌다. CI 칸 하나로 이 차이를 보인다.

## 남은 것 · 아는 문제

- `CONTEXT.md` 8절 ERD 는 지금 스키마와 다르다. 없는 테이블 5개(asset_ledger 등), 빠진 테이블 9개(judgment_run 등), transaction · judgment 구조 변화가 있다. 고치지 않았다.
- 6관문 그림의 G4 예시(맥북 350만원 → 583,333원)는 E-045 의 지금 기대값(즉시상각 특례, 전액 경비)과 다르다.
- 협업 자동화 페이지는 AWS release 가 release PR 에서만 돈다고 적었지만 develop PR 에서도 돈다.
- ERD 그림은 주요 관계만 담아 FK 일부(user_fact → upload_batch, question_queue → user_fact, 판정 원인 FK 4개)가 빠져 있다.
- 판정로직 · 아키텍처 페이지와 DB 스키마 페이지의 홈 카드 설명은 바꾸지 않았다.
- 검색 결과 캡처의 사이트 이름은 아직 「Duck DNS」다.

## 16:36 개발 가이드에 AI 실험 페이지 추가 (2651eb12)

- 커밋: 2651eb12 (1개)
- 주요파일: docs/site/index.html

### 한 일

- 기술 스택 다음에 「AI 실험」 페이지(`08b-Experiments`)를 새로 만들었다. 뒤 페이지들의 원본 번호(API 3 → 4 … 배포 9 → 10)를 하나씩 밀었고, 홈 카드 설명을 더했다.
- 맨 위에 실험 목록 표(영역 · 실험 · 주제, 8개)와 실험 원칙 4가지(1회 결과 불신, 같은 날 대조군, 기준 먼저, 최종 결과로 판단)를 두었다.
- 본문은 영역별로 실험마다 질문 · 비교 표 · 결정을 적었다.
  - 규칙 카드 생성: 기본 조문 전제화(9/23), 모델 gpt-4o-mini → GPT-6 Luna(10/9), RRF vs 벡터 단독(10/16~10/26), HNSW vs 정확 스캔
  - 가맹점 분류: 문자 n-gram 분류기 vs 임베딩(9/23), 상권정보 매칭 · 해외 결제 사전(9/28 · 10/5), Jev 1.14 vs GPT-6 Luna(10/30)
  - 비서 Really: Luna vs Haiku 5.5(10/15), openai SDK vs LangChain(10/15), 프롬프트 인젝션(11/2)
- 수치는 `docs/rag-eval.md`, `docs/agent-secretary.md` 7~8장, `docs/category_*.md`, `docs/merchant_matching_eval.md`, `docs/overseas_saas_eval.md`, `docs/really-prompt-injection-report.md`, `db/rag.sql` 주석과 대조했다.
- 실험 제목은 사용자가 「○○ 비교 실험: 주제」 형식으로 고쳤고, 목록 표는 그 앞뒤를 실험 · 주제 칸으로 나눴다. 기본 조문 전제화와 상권정보 매칭 · 해외 결제 사전은 실험이 아니라 보고 목록 표에서만 뺐다.

### 왜 이렇게 했나

- 규모는 「대화 108턴」, 「초안 12회」처럼 무엇을 센 숫자인지 드러나게 썼다. 발표 준비 때 「108회」가 실험 횟수로 읽혀 문제가 된 적이 있다.

### 남은 것 · 아는 문제

- 상권정보 매칭과 해외 결제 도구 사전은 측정까지만 했고 서비스 분류 흐름에는 없다(백엔드 `ClassificationStage`, 도구 사전은 `tools/exp_overseas_saas/` 에만 있음). 페이지에도 그렇게 적었다.
- 목록 표는 8개인데 본문 실험은 10개다(표에서 뺀 2개가 본문에 남아 있음).
- 기술 스택 페이지 「AI 도구 선정 근거」의 LangChain 이유는 `CONTEXT.md` 12절의 옛 문구라, 실험 페이지의 측정 근거(`docs/agent-secretary.md` 7장)와 다르다.
