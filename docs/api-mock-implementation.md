# mock-server가 실제로 구현한 계약

`docs/api.md`는 이상적인 API 스펙이고, 이 문서는 `mock-server/`(NestJS)가 **실제로** 무엇을, 어떻게 구현했는지를 기록한다. 목적은 두 가지다.

1. 나중에 Spring Boot(`backend/`)로 동일 계약을 옮길 때, mock이 실제로 어떤 선택을 했는지 바로 대조할 수 있는 레퍼런스로 쓴다.
2. `docs/api.md`와 실제 구현이 갈라진 지점 — 스펙 해석, 스펙에 없어서 발명한 값, 의도적으로 단순화한 부분 — 을 한 곳에 모아 추적한다.

mock-server는 **인메모리 단일 `StoreService`** 하나로 모든 상태를 들고 있고(`src/store/store.service.ts`), 서버 재시작 시 초기화된다. 판정 로직(6관문 룰카드)은 이식하지 않았다 — "기능 자체는 중요하지 않고 동작하는 느낌만 나면 된다"는 원래 요구에 따라, 실제 업무 로직 대신 소규모 카테고리→verdict 매핑(`src/common/mock-verdict.ts`)으로 대체했다.

---

## 계약 동기화 (2026-09-22)

#42 스웨거 대조 리뷰에서 나온 api.md-mock 불일치를 반영해 두 축을 다시 맞췄다. 요지:

- **카테고리**: api.md §2.12가 27종 나열 대신 `rules/categories.yaml`(32종) + `미분류`를 가리키도록 바뀌었다. 아래 "merchantCategory enum" 절의 divergence는 해소됐다.
- **outOfScope**: api.md §3.7·mock 둘 다 없던 필드를 mock에도 구현했다(아래 6절 참고). backend에는 원래 있던 필드다.
- **응답 형태**: Context 조회, 업로드 배치 목록·상세, `grouped=false` 질문·분류 항목의 응답 형태가 api.md에 추가됐다. mock 응답이 정본이다.
- **에러 코드**: mock이 쓰던 코드가 api.md에 모두 문서화됐다(공통/fallback 표 + 엔드포인트별). 아래에서 "문서에 없는 발명"이라 적힌 코드들(`IDEMPOTENCY_KEY_REQUIRED`, `INVALID_SUMMARY_SCOPE`, `REVIEWS_FROM_DIFFERENT_BATCHES`, `VALIDATION_ERROR`, 각 `*_NOT_FOUND`)은 이제 계약에 있다.
- **mock 내부 불일치 수정**: "배치 없음"을 `UPLOAD_BATCH_NOT_FOUND`(업로드·판정실행)와 `BATCH_NOT_FOUND`(bulk-answer)로 나눠 쓰던 것을 `BATCH_NOT_FOUND` 하나로 통일했다.

---

## 공통 (docs/api.md 1장)

- 전역 prefix `/api/v1`, 전역 `ValidationPipe({whitelist:true, transform:true})`, 전역 예외 필터(`src/common/http-exception.filter.ts`)가 모든 예외를 `{code, message, traceId}`로 통일한다. `traceId`는 `uuid`의 v7로 매 응답마다 새로 생성한다.
- **인증**: `BearerAuthGuard`(전역 `APP_GUARD`)가 `Authorization: Bearer ...` 헤더 존재만 확인한다. 실제 토큰 검증/사용자 구분은 하지 않는다 — mock에는 시딩된 사용자 1명만 존재한다.
- **페이지네이션**: `paginate()` 헬퍼(`src/common/pagination.ts`) 하나로 모든 목록 API가 `{items, page:{number,size,totalElements,totalPages,hasNext}}`를 반환한다. `size`는 1~100으로 clamp한다. `page`/`size`가 숫자로 파싱 안 되는 값(`?page=abc`)이면 문서 기본값(0, 20)으로 대체한다 — 이 가드가 없으면 `page.number`/`size`/`totalPages`가 `NaN`으로 새어나가고 목록이 통째로 빈 배열이 되는 버그가 있었다(리뷰에서 발견, 수정됨).
- **코드값**: `coded()` 헬퍼(`src/common/coded.ts`) + docs/api.md §2 표를 그대로 옮긴 라벨 테이블로 `{code,label}`을 만든다. **`userInclusion`만 예외**로 bare string(`"AUTO"`)으로 응답한다 — docs/api.md §1.5의 코드값 규칙과 §2.3의 실제 예시가 다른 지점이라, 예시(bare string) 쪽을 따랐다.
- **문서에 없는 제네릭 검증 실패**(필수 필드 누락, 타입 불일치 등)는 400 `VALIDATION_ERROR`로 통일한다. 문서화된 특정 에러 코드(예: `MISSING_NATURAL_KEY`, `INVALID_SOURCE_TYPE`)가 있는 필드는 DTO 검증을 일부러 느슨하게 두고 서비스 레이어에서 직접 해당 코드를 던진다 — 그래야 generic 400이 아니라 문서화된 코드가 나간다.

---

## 1. users / contexts (`src/users/`)

- `GET /users/me`, `DELETE /users/me`(204, 실제 삭제는 하지 않음).
- `POST /users/me/contexts` — 매번 새 버전 생성(수정 없음), 응답 `{id, version}`.
- `GET /users/me/contexts/current` — 없으면 `404 CONTEXT_NOT_FOUND`.
- `GET /users/me/contexts` — 버전 이력, 페이지네이션 없음(문서대로).
- `bookkeepingDuty`는 coded 값이 아니라 enum 문자열 그대로 응답한다(`복식부기`/`간편장부`/`추계`) — docs/api.md §2.9에 label 테이블이 없어 원문 자체가 label이다.

## 2. upload-batches (`src/upload-batches/`)

- `POST /upload-batches` — `Idempotency-Key` 헤더 필수(문서에 없는 발명: 누락 시 400 `IDEMPOTENCY_KEY_REQUIRED`). 동일 키+동일 payload(SHA-256 해시로 비교) → 최초 응답 재생, 동일 키+다른 payload → `409 IDEMPOTENCY_KEY_REUSED`. 기록은 생성 시점부터 24시간 유효하며, 테스트에서는 `expiresAt`을 직접 조정해 만료를 재현한다.
- `sourceType`은 `'승인내역'`이 아니면 `422 INVALID_SOURCE_TYPE`, 빈 `transactions[]`는 `422 EMPTY_TRANSACTIONS`, `naturalKey` 누락은 `422 MISSING_NATURAL_KEY` — 모두 서비스 레이어 수동 체크(§공통 참고).
- `naturalKey` 중복(`user` 범위, 전체 배치 통틀어)은 스킵 처리, `fileHash` 중복은 `409 DUPLICATE_FILE`.
- **가맹점 분류는 실제 rules/keyword_rules.yaml(정규식+우선순위 엔진)을 이식하지 않았다.** 대신 `src/upload-batches/classify-merchant.ts`의 훨씬 작은 키워드 표 하나로 대체했다 — 매칭 실패 시 `미분류`+`ClassificationReview` 생성까지는 문서대로 동작하지만, 분류 정확도 자체는 mock의 목적이 아니다.
- `DELETE /upload-batches/{batchId}` — cascade 삭제(transactions, classificationReviews, judgmentRuns, judgments, questions, userFacts, judgmentOverrides) 구현, `StatuteVersion`은 문서대로 삭제하지 않음. 아직 유효한 Idempotency 기록은 삭제하지 않고 `DELETED`로 바꾸며, 같은 요청을 재전송하면 `410 IDEMPOTENCY_RESULT_DELETED`를 반환한다. TTL 만료 뒤에는 새 요청으로 처리한다.

## 3. transactions (`src/transactions/`)

- `effectiveStatus`는 `computeEffectiveStatus()`(`src/common/coded.ts`)로 매 응답 시 계산한다 — 별도 컬럼으로 저장하지 않는다.
- `include`/`exclude`는 `userInclusion`만 바꾸고 새 Judgment revision을 만들지 않는다(문서대로). `sourceStatus=CANCELED_OFFSET`에 `include` 시도 시 `409 CANCELED_TRANSACTION_NOT_INCLUDABLE`.
- 두 엔드포인트 모두 `200`을 반환한다(문서에 명시된 코드는 없지만, `override`처럼 "기존 리소스를 변경하고 그 결과를 반환"하는 계열은 `200`으로 통일한다는 이 mock 자체의 내부 규칙을 따른다 — 원래 Nest 기본값인 `201`로 남아있던 걸 리뷰에서 발견해 맞춤).

## 4. classification-reviews / classification-responses (`src/classification/`)

- `grouped=true`는 `merchantNorm` 기준으로 묶는다. `count`는 항상 `reviewIds.length`와 일치하도록 그 자리에서 계산한다(하드코딩하지 않음).
- 분류 확정 시 재판정: 해당 batch에 **완료된** JudgmentRun이 있으면 가장 최근 시작한 완료 Run의 `contextVersion`을 이어받아 `origin.type=CLASSIFICATION_REVIEW`인 새 revision을 만든다. 없으면 `judgedCount=0`. 이때 생성되는 판정의 `account`/`finalAmount`/`blockedAtGate`는 `judgment-runs`와 동일하게 `mockJudgmentFields()`(`src/common/mock-verdict.ts`)로 채운다 — 예전엔 이 경로만 셋 다 `null`로 남아 있었다(리뷰에서 발견, 수정됨).
- verdict는 `pickVerdictForCategory()`(`src/common/mock-verdict.ts`)로 카테고리 기반 추정.
- `미분류` 응답은 `422 UNCLASSIFIED_CATEGORY_NOT_ALLOWED`, 허용되지 않는 카테고리는 `422 INVALID_MERCHANT_CATEGORY`, 이미 처리된 리뷰는 `409 CLASSIFICATION_ALREADY_RESOLVED`.
- `reviewIds`가 서로 다른 배치에 걸쳐 있으면 `422 REVIEWS_FROM_DIFFERENT_BATCHES`(문서에 없는 발명 코드, `question-responses`의 `QUESTIONS_FROM_DIFFERENT_BATCHES`와 대칭). 이 체크가 없었을 때는 요청에 포함된 모든 review가 `reviews[0].batchId`의 Run 유무·context를 그대로 적용받아, Run이 아예 없는 배치의 거래까지 판정이 생기는 실제 데이터 오염이 있었다(리뷰에서 발견, 수정됨).

## 5. judgment-runs (`src/judgment-runs/`)

- **진행률은 poll 횟수 기반으로 흉내낸다.** `POST`로 대상 거래(`effectiveStatus=JUDGEABLE AND classificationStatus=CLASSIFIED`)를 즉시 동기 판정해 Judgment를 전부 만들어두고, `GET`을 부를 때마다 내부 `pollCount`를 근거로 `QUEUED`(1회차) → `RUNNING`(2회차) → `COMPLETED`(3회차 이상)로 상태와 `processedCount`만 단계적으로 노출한다. 타이머·백그라운드 잡은 없다.
- 실제 룰카드 대신 `pickVerdictForCategory()`로 verdict를 정하고, `account`/`finalAmount`/`blockedAtGate`/`outOfScope`는 `mockJudgmentFields()`(`src/common/mock-verdict.ts`)로 채운다(`AVAILABLE`→account=`소모품비`+finalAmount=amount, `NEEDS_REVIEW`→G2, `UNAVAILABLE`→G1). 이 헬퍼는 `classification-responses` 경로와 공유한다 — 따로 두면 같은 verdict인데 계정과목/금액 유무가 갈리는 불일치가 생긴다(리뷰에서 발견, 공유 헬퍼로 통합). `citations`는 항상 빈 배열이다.
- **outOfScope**(범위 밖/핸드오프)는 backend엔 있으나 api.md·mock엔 없던 필드라 mock에도 추가했다. 룰카드가 없으므로 `mock-verdict.ts`의 `OUT_OF_SCOPE_LIKE` 카테고리 소집합(`차량`)으로 흉내내며, `isOutOfScope(verdict, category)` = `verdict==='NEEDS_REVIEW' && OUT_OF_SCOPE_LIKE.has(category)`로 계산한다. 근거: 실제 `out_of_scope: true` 카드는 R-070(차량)·R-071(급여원천세)뿐이고 R-071은 category를 걸지 않아 카테고리 근사로는 `차량`만 해당한다(`PG_미상`(R-105)은 out_of_scope가 아니라 되묻기 대기다). 불변식(NEEDS_REVIEW일 때만 true)은 backend `RuleCardLoader`와 동일하게 지킨다. question 재판정은 `isOutOfScope`를 직접 호출하고 override는 `toVerdict!=='NEEDS_REVIEW'`이면 false로 리셋한다. seed 판정은 모두 정적으로 작성돼 부팅 시 `outOfScope=true`인 항목은 없지만(차량 seed tx1024는 "사업용 차량 없음" 사실이 반영된 UNAVAILABLE 확정 케이스), 해당 배치를 재판정하면 tx1024가 `NEEDS_REVIEW`+`outOfScope=true`로 나온다.
- `GET /judgment-runs/{runId}/failures`는 **항상 빈 페이지**를 반환한다 — 기술적 실패 시나리오는 재현하지 않았다.
- **알려진 한계**: 이 mock은 `NEEDS_REVIEW` 판정을 만들 때 대응하는 `Question`을 새로 생성하지 않는다(§8.3 흐름의 "Judgment rev1 NEEDS_REVIEW → Question 생성" 단계는 시드 데이터로만 재현되고, 새로 업로드·재판정한 배치에서는 일어나지 않는다). Question은 오직 `src/seed/seed-data.ts`에만 존재한다.

## 6. judgments / override (`src/judgments/`)

- "현재 결과"(batchId/year)와 "Run 결과"(runId)를 분리했다: batchId/year는 `computeEffectiveStatus=JUDGEABLE AND classificationStatus=CLASSIFIED`인 거래에서 활성 Override를 우선하고, 없으면 latest non-override revision을 사용한다. runId는 `judgment.runId`(=origin.type이 RUN일 때만 채워지는 내부 FK 필드)로 직접 필터링한다. `runId`와 `latestOnly`는 동시에 의미 있게 쓰이지 않는다(문서대로).
- `GET /judgments/summary`는 `batchId`/`year`/`runId` 중 정확히 하나만 허용, 아니면 `400 INVALID_SUMMARY_SCOPE`(문서에 없는 발명 코드).
- `Judgment.state`(PROVISIONAL/FINALIZED) 필드는 만들지 않았다 — 현재 스펙(§3.7 "state 제거")이 명시적으로 제거한 필드이고, `frontend/src/mock/judgments.ts`/`types/domain.ts`에 남아있는 건 stale 버전이다.
- `override`는 원본 Judgment를 보존하고 `revision+1`, `origin.type=OVERRIDE`로 새 Judgment를 만든다. `account`/`finalAmount`/`citations` 등은 원본에서 그대로 이어받고 `verdict`만 바뀐다. 같은 Transaction의 기존 활성 Override는 비활성화하며, `DELETE /judgment-overrides/{overrideId}`는 Override 이력을 삭제하지 않고 `active=false`, `releasedAt`을 기록한다.
- `toVerdict`가 `AVAILABLE`/`UNAVAILABLE`/`NEEDS_REVIEW` 중 하나가 아니면 DTO의 `@IsIn`이 generic 400을 던진다 — 문서에 전용 에러 코드가 없어 그대로 두었다.

## 7. questions / question-responses (`src/questions/`)

- `ClassificationReview`(가맹점 분류 질문)와 `Question`(룰엔진 확인 질문)을 명확히 분리했다(§0.5). 시드 데이터에서도 미분류 거래(tx1023)는 Question이 아니라 ClassificationReview로만 존재한다.
- `GET /questions`의 `unresolved`는 `batchId`·`transactionId` 범위에서 `PENDING` 질문 수를 세고, 연결된 Transaction을 중복 제거해 금액을 합산한다. `status` 필터와 페이지네이션은 이 집계에 적용하지 않는다.
- `question-responses` 처리 순서: batch 일치(`422 QUESTIONS_FROM_DIFFERENT_BATCHES`) → groupKey와 factType 일치(`409 QUESTION_GROUP_MISMATCH`) → `CANCELED`가 아님(`409 QUESTION_NOT_ANSWERABLE`) → 답변값이 `options` 안에 있는지(`422 INVALID_ANSWER_VALUE`) → 새 version의 `UserFact` 생성 → **요청에 명시된 questionIds뿐 아니라, 같은 배치·같은 scope(groupKey)·같은 factType의 다른 `PENDING` 질문도 함께** `ANSWERED` 처리하고 재판정 대상에 포함 → 영향받는 거래마다 새 revision(`origin.type=USER_FACT`) → **같은 거래를 겨냥한 다른 `PENDING` 질문을 기계적으로 `CANCELED`** 처리. `ANSWERED` 질문을 다시 보내면 기존 UserFact를 덮어쓰지 않고 다음 version으로 정정한다.
  - 이 "scope 조회" 단계는 §3.10 4단계("동일 Batch에서 Fact의 scope가 영향을 주는 Transaction 조회")를 문자 그대로 구현한 것이다. 예전엔 요청에 명시된 questionIds만 처리하고 이 조회 단계를 건너뛰어서, 같은 scope의 다른 PENDING 질문이 방치되는 문제가 있었다(리뷰에서 발견, 수정됨). `answeredCount`는 요청에 명시된 개수가 아니라 실제로 `ANSWERED`된 총 개수(sibling 포함)를 반환한다.
  - 이 수정과 짝을 이뤄 시드 데이터의 groupKey도 정리했다: docs/api.md 3.10의 scopeKey 예시(`merchant:스타벅스`)는 상호 1개=scope 1개인데, 예전 시드는 "merchant:카페 · 편의점"(스타벅스+GS25), "merchant:통신비 · 자택 관리비"(SK텔레콤+관리비)처럼 서로 다른 상호를 한 groupKey로 묶어놨었다. 그대로 두면 "scope 조회"가 서로 무관한 상호까지 한꺼번에 답변 처리해버리므로, 상호 1개당 groupKey 1개로 쪼갰다(`src/seed/seed-data.ts`의 `RAW_QUESTION_GROUPS`, 6개 그룹으로 늘어남).
- "더 이상 필요 없는 질문만 취소"라는 실제 룰엔진 판단은 흉내내지 않는다 — mock은 "같은 거래를 다시 겨냥하면 무조건 취소"로 단순화했다.
- `POST /questions/bulk-answer`는 같은 Batch·factType의 `PENDING` 질문을 scopeKey별 UserFact로 묶어 답변하고, 영향 Transaction을 중복 제거해 한 번씩 재판정한다. 다른 factType 질문은 변경하지 않으며 처리 후 `unresolved`를 반환한다.
- 재판정 verdict는 시드 데이터의 `QUESTION_ANSWER_VERDICT` 룩업 테이블(`src/seed/seed-data.ts`, 원본은 `frontend/src/mock/judgments.ts`의 `QUESTION_ANSWER_VERDICT`)을 그대로 쓴다. 테이블에 없는 groupKey/답변 조합은 `AVAILABLE`로 fallback한다.
- 응답에 `runId`는 없다(`{answeredCount, factId, rejudgedTransactionCount}`) — 현재 스펙이 명시적으로 제거한 필드다.

## 8. statutes (`src/statutes/`)

- `hierarchy` 필드는 `statuteId` 접두어로 기계적으로 매핑한다(`소득세법시행령-*`→시행령, `소득세법-*`→법률, `기본통칙-*`→기본통칙, `대법원-*`/`조심-*`→판례). `frontend/src/mock/statutes.ts` 원본에는 이 필드가 없었다(스펙에 나중에 추가됨).

---

## merchantCategory enum (해소됨)

mock-server의 카테고리 검증(`src/common/merchant-category.ts`)은 `rules/categories.yaml`의 **32개** + `미분류`를 기준으로 한다(`docs/categories.md`도 이 yaml에서 생성된다). 실제 seed 데이터(예: `전자기기`, `임차료`)도 이 목록을 전제로 한다.

예전엔 api.md §2.12가 27개만 나열해 갈라져 있었으나(누락: `임차료`, `전자기기`, `전문가수수료`, `보험`, `수리비`), 2026-09-22에 api.md가 `rules/categories.yaml` 포인터로 바뀌어 mock과 일치한다.

---

## 충실도 노트

**단순화한 부분** (frontend 통합 테스트 가치에 영향이 적다고 판단):
- JudgmentRun 진행률(poll 횟수 기반 fake, 실제 지연 없음)
- Question "더 이상 불필요" 판정(같은 거래를 겨냥하면 무조건 취소)
- `judgment-runs/{runId}/failures`(항상 빈 페이지)
- 가맹점 분류 로직(실제 rules/keyword_rules.yaml 대신 작은 키워드 표)
- 판정 로직 자체(6관문 룰카드 대신 카테고리→verdict 매핑)
- `outOfScope` 근사(룰카드 `out_of_scope` 대신 카테고리 `차량` 하나만 핸드오프로 흉내 — R-071은 category를 안 걸어 재현 불가, seed엔 정적 true 케이스 없음. 자세히는 5절)
- 문서에 없는 제네릭 검증 실패(400 `VALIDATION_ERROR`로 통일), Idempotency-Key 누락 처리(문서에 없는 `IDEMPOTENCY_KEY_REQUIRED`)

**충실하게 구현한 부분** (스프링 이관 시 계약 충실도를 좌우하므로 정확히 맞춤):
- 문서화된 모든 에러 코드와 상태 코드
- `{code,label}` vs `userInclusion` bare-string 예외
- revision/origin 정확성(`RUN`/`USER_FACT`/`CLASSIFICATION_REVIEW`/`OVERRIDE`, append-only, `runId`와 `latestOnly`의 의미 분리)
- `judgments`/`judgments/summary`가 batchId·year(현재 결과, 제외 거래 반영)와 runId(과거 결과, 고정) 를 다르게 계산하는 규칙
- 활성 Override 우선, 새 Override의 기존 활성 Override 대체, Override 해제 후 latest non-override 복귀 규칙
- Idempotency-Key 24시간 TTL, Batch 삭제 tombstone, `410 IDEMPOTENCY_RESULT_DELETED` 규칙
- Batch 삭제 cascade 범위(StatuteVersion은 보존)

---

## 리뷰에서 결정해 계약과 mock에 반영한 스펙 공백

목 서버를 실제로 굴려보며 흐름을 점검한 뒤 정책을 결정해 반영한 항목들이다. Spring Boot로 옮길 때도 동일한 규칙을 유지해야 한다.

- **Override 유지**: 자동 판정 revision은 계속 생성하지만 활성 Override가 현재 결과보다 우선한다. 새 Override는 기존 활성 Override를 대체하고, 사용자가 명시적으로 해제하면 latest non-override revision으로 복귀한다.
- **삭제된 Batch의 Idempotency-Key**: 최초 요청부터 24시간 동안 기록을 유지한다. Batch 삭제 시 `DELETED` tombstone으로 바꾸고 같은 요청에는 `410`을 반환하며, TTL 만료 뒤에는 새 요청으로 처리한다.

## 리뷰로 발견하고 mock에서 고친 것

위 두 가지와 달리, 아래는 스펙이 뭐라 하든 mock 자체의 구현 실수였던 것들 — 이미 이 문서의 해당 절에 반영했지만 한눈에 보기 위해 모아둔다.

- 페이지네이션 `page`/`size`가 숫자로 안 읽히면 응답이 `null`로 오염됨 (공통 절)
- `classification-responses`로 만든 AVAILABLE 판정에 `account`/`finalAmount`가 안 채워짐 (4절)
- `classification-responses`가 서로 다른 배치의 reviewId를 섞으면 다른 배치 데이터까지 오염됨 (4절)
- `transactions/{id}/include`·`/exclude`가 이 mock의 자체 규칙(기존 리소스 변경 후 반환 = 200)과 다르게 201을 반환하고 있었음 (3절)
- `question-responses`가 같은 scope(groupKey)의 다른 PENDING 질문을 무시하고 요청에 명시된 것만 처리함 + 시드 데이터의 groupKey가 서로 다른 상호를 한 scope로 묶어놨던 것 (7절, 시드 데이터 절)

---

## 시드 데이터

서버 부팅 시 업로드 없이 바로 탐색 가능한 배치 하나가 시딩된다(`src/seed/seed-data.ts`, `src/seed/seed.service.ts`). 내용은 `frontend/src/mock/judgments.ts`·`frontend/src/mock/statutes.ts`의 실제 한국어 콘텐츠(거래 24건, 법령 12건)를 현재 계약 모양으로 재구성한 것이다.

- 거래 24건 중 23건은 `classificationStatus=CLASSIFIED`로 시딩되어 곧바로 판정 대상이고, 1건(tx1023, ELEVENLABS IO)은 `미분류`로 남겨 `ClassificationReview`(PENDING) 하나가 함께 시딩된다.
- 시딩된 `JudgmentRun`은 `pollCount`를 완료 임계치 이상으로 미리 설정해두어, 재시작 직후 조회해도 바로 `COMPLETED`로 보인다 (새로 만든 Run만 QUEUED→RUNNING→COMPLETED 애니메이션을 보여준다).
- Question은 frontend 원본의 5개 그룹이 아니라 **6개 그룹**(상호 1개당 1그룹)을 시딩한다 — "분류하지 못한 가맹점" 그룹은 ClassificationReview와 중복되는 항목이라 제외했고(§0.5, 위 7절 참고), 나머지 중 서로 다른 상호를 한 그룹으로 묶었던 2개("카페 · 편의점", "통신비 · 자택 관리비")는 상호 단위로 쪼갰다(위 7절 참고).
- `frontend/src/mock/judgments.ts`/`types/domain.ts`의 stale 필드(`state`, flat `status`, `QuestionResponseResult.runId`)는 옮기지 않았다.
