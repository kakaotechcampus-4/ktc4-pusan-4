# 분류 API 계약에 timedOut 추가 (#197 리뷰)

- 브랜치: feature/classify-backend
- 커밋: 5b9589b (1개)
- 주요파일: docs/backend_api_plan.md

## 한 일

- `backend_api_plan.md` 의 10/16 분류 API 계약에 `timedOut` 을 적었다. AI 서버 `POST /classify/merchants` 응답에서 마감(8초)을 넘긴 merchantNorm 목록이다
- 백엔드 코드는 바꾸지 않았다
  - `results` 의 `null` 은 그대로라 `AiServerModelClassifier` 가 읽는 모양은 같다
  - `RestClient` 의 Jackson 은 모르는 필드를 무시하므로 새 필드가 와도 깨지지 않는다

## 왜 이렇게 했나

- #197 리뷰가 실패와 시간 초과를 구분해 달라고 했다. 백엔드가 나중에 다시 묻는 정책을 붙일 때 쓰라는 뜻이다
- AI 서버(PR2)가 이 필드를 더했으니, 계약 단일 원본인 이 문서도 같이 고쳤다

## 남은 것 · 아는 문제

- 시간 초과 가맹점을 다시 묻는 정책은 아직 없다

## 13:33 새 필드를 받아도 깨지지 않는지 확인

- 가짜 AI 서버 응답에 `timedOut` 을 넣고 `MerchantModelClassifyIntegrationTest` 6건이 통과하는 것을 봤다 (76aa1a2)

## 13:57 develop 머지 — 충돌 2곳 해결 (#209)

- 커밋: e8335a4
- `application.yml`: 우리 `app.classify` 블록은 두고, 인증 주석은 develop 문장("리프레시 토큰은 Redis 에 둔다")을 썼다
- `docs/backend_api_plan.md` 10/16 결정 표
  - 분류 행은 우리 것: 10/19 결정, 계약, 10/30 실험, 10/31 결정, `timedOut`
  - 금액 행은 develop 것: 결정(10/28)
- develop 이 `ClassificationReviewService.resolve()` 에 한도 재집계를 넣은 것은 자동 머지됐다. 후보 조회(`items()`)와 겹치지 않는다
- 마이그레이션 번호는 겹치지 않는다(develop 은 V14 까지)
- 머지 후 `gradlew check` 통과(unit 396, integration 235, PMD)

## 14:31 마이그레이션 V15 → V19 (#209 리뷰)

- 커밋: 04b99c4
- `V15__create_merchant_model_decision.sql` 을 `V19__` 로 옮기고, 엔티티 주석과 `backend_api_plan.md` B10 의 번호를 고쳤다. 내용은 그대로다
- 리뷰(memoryhong · yuyeol3)는 V18 을 권했다. 열린 PR 이 V15(#177) · V16(#176) · V17(#174)을 쓰기 때문이다. 그런데 리뷰 뒤에 올라온 #214 가 V18 을 써서 V19 로 했다
- 확인: `BackendApplicationIntegrationTest`(Flyway 초기화) 5건, `MerchantModelClassifyIntegrationTest` 6건 통과
- 주의: Flyway 는 `out-of-order` 를 끈 기본값이다. 그래서 #209 를 V15~V18 PR 보다 먼저 배포하면, 뒤에 오는 마이그레이션이 기동 검증에서 막힌다. 머지는 리뷰어가 정한 순서대로 마지막에 한다
