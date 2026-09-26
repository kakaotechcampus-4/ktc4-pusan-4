## 0. 핵심 설계 원칙

### 0.1 리소스 역할

```
UploadBatch
  └─ Transaction
       ├─ ClassificationReview
       │    └─ 분류 확정
       │
       └─ Judgment
            ├─ Question
            │    └─ UserFact
            │         └─ 재판정 → 새 Judgment revision
            │
            └─ JudgmentOverride
                 └─ 새 Judgment revision
```

- `UploadBatch`: 사용자가 한 번 업로드한 카드내역 묶음
- `Transaction`: 카드내역의 개별 거래
- `ClassificationReview`: 가맹점 분류에 실패해 사용자 확인이 필요한 거래
- `JudgmentRun`: 한 Batch에 대해 명시적으로 실행한 일괄 판정 작업
- `Judgment`: Transaction 하나에 대한 판정 결과
- `Question`: 룰엔진이 판정 도중 추가 사실이 필요해 생성한 질문
- `UserFact`: Question에 대한 사용자 응답으로 확정된 사실
- `JudgmentOverride`: 사용자가 이미 나온 판정 결과를 직접 수정한 기록

### 0.2 Judgment는 transaction 단위 revision으로 저장한다

```
Transaction T1

rev1  NEEDS_REVIEW
rev2  AVAILABLE
rev3  UNAVAILABLE
```

이전 Judgment를 `UPDATE`하지 않는다.

재판정 또는 사용자 수정이 발생하면 항상 새로운 revision을 생성한다.

### 0.3 JudgmentRun과 현재 결과를 분리한다

`JudgmentRun`은 특정 시점에 수행된 일괄 실행의 이력이다.

```
Run R1
 ├─ T1 → Judgment rev1
 ├─ T2 → Judgment rev1
 └─ T3 → Judgment rev1
```

이후 Question 응답이나 Override로 생성된 revision은 기존 Run에 편입하지 않는다.

따라서:

```
runId 조회
→ 그 Run이 실제 생성했던 판정

batchId / year 조회
→ 각 Transaction의 현재 latest 판정
```

으로 의미를 분리한다.

### 0.4 NEEDS_REVIEW는 실행 실패가 아니다

```
AVAILABLE
UNAVAILABLE
NEEDS_REVIEW
```

는 모두 정상적인 판정 결과다.

`PARTIAL_FAILED`, `FAILED`는 DB 오류, 룰 카드 로딩 실패 등 기술적 처리 실패만 의미한다.

### 0.5 분류 질문과 룰엔진 질문을 분리한다

```
ClassificationReview
= 판정 입력인 merchantCategory를 확정하기 위한 질문

Question
= 룰엔진이 판정하면서 추가 사실을 요구하는 질문
```

`merchantCategory = 미분류`인 Transaction은 Rule Engine에 전달하지 않는다.

---

# API Tree

```
/api/v1
│
├── users/
│   └── me/
│       ├── GET                         내 정보 조회
│       ├── DELETE                      회원 탈퇴
│       │
│       └── contexts/
│           ├── POST                    사업자 Context 생성
│           ├── GET                     Context 버전 이력 조회
│           │
│           └── current/
│               └── GET                 현재 Context 조회
│
├── upload-batches/
│   ├── POST                            카드내역 업로드
│   ├── GET                             업로드 배치 목록
│   │
│   └── {batchId}/
│       ├── GET                         배치 상세
│       └── DELETE                      배치 및 종속 데이터 삭제
│
├── transactions/
│   ├── GET                             거래 목록
│   │
│   └── {transactionId}/
│       ├── GET                         거래 상세
│       ├── include/
│       │   └── POST                    사용자가 판정 대상에 포함
│       └── exclude/
│           └── POST                    사용자가 판정 대상에서 제외
│
├── classification-reviews/
│   └── GET                             미분류 확인 목록
│
├── classification-responses/
│   └── POST                            미분류 거래 분류 응답
│
├── judgment-runs/
│   ├── POST                            Batch 전체 판정 실행
│   │
│   └── {runId}/
│       ├── GET                         판정 실행 상태 조회
│       └── failures/
│           └── GET                     거래별 기술적 실패 조회
│
├── judgments/
│   ├── GET                             판정 목록 및 revision 조회
│   │
│   ├── summary/
│   │   └── GET                         판정 결과 요약
│   │
│   └── {judgmentId}/
│       ├── GET                         판정 상세
│       │
│       └── override/
│           └── POST                    사용자 판정 수정
│
├── judgment-overrides/
│   └── {overrideId}/
│       └── DELETE                      사용자 판정 수정 해제
│
├── questions/
│   ├── GET                             룰엔진 확인 질문 목록
│   └── bulk-answer/
│       └── POST                        미해소 질문 일괄 응답
│
├── question-responses/
│   └── POST                            확인 질문 응답 및 부분 재판정
│
└── statutes/
    └── {statuteVersionId}/
        └── GET                         법령 원문 조회
```

> v2에서는 JudgmentRun SSE API를 사용하지 않는다. Rule Engine은 LLM, 외부 API, 현재 시각, 난수에 의존하지 않는 로컬 결정론적 연산이므로 우선 `GET /judgment-runs/{runId}` polling으로 충분하다고 본다. 실제 성능 측정 후 장시간 실행이 확인되면 SSE를 다시 검토한다.
> 

---

# 1. 공통

## 1.1 인증

```
Authorization: Bearer {accessToken}
```

---

## 1.2 타입

```
ID        UUID v7 문자열
시각      ISO-8601 + KST
날짜      ISO-8601
금액      정수, 원 단위
```

예시:

```
ID      "0199c8f2-1a2b-7c3d-8e4f-5a6b7c8d9e0f"
시각    "2026-09-01T10:00:00+09:00"
날짜    "2026-01-03"
금액    37000
```

`statuteVersionId`만 bigint다.

---

## 1.3 에러 응답

```
{
  "code": "TRANSACTION_NOT_FOUND",
  "message": "요청한 거래를 찾을 수 없습니다.",
  "traceId": "0199c8f2-..."
}
```

각 엔드포인트에 명시한 전용 `code` 외에, 전용 코드가 없는 실패는 상태 코드별 공통 코드로 내려간다.

| 상태 | code | 쓰임 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 필수 필드 누락·타입 불일치 등 문서화되지 않은 요청 검증 실패 |
| 401 | UNAUTHORIZED | `Authorization` 헤더 누락 |
| 404 | NOT_FOUND | 전용 `*_NOT_FOUND`가 없는 경로의 리소스 없음 |
| 409 | CONFLICT | 전용 코드가 없는 상태 충돌 |
| 422 | UNPROCESSABLE_ENTITY | 전용 코드가 없는 처리 불가 |
| 500 | INTERNAL_ERROR | 그 외 서버 오류 |

단건 리소스 조회의 404는 리소스별 전용 코드를 쓴다: `BATCH_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `CONTEXT_NOT_FOUND`, `JUDGMENT_NOT_FOUND`, `JUDGMENT_RUN_NOT_FOUND`, `JUDGMENT_OVERRIDE_NOT_FOUND`, `CLASSIFICATION_REVIEW_NOT_FOUND`, `QUESTION_NOT_FOUND`, `STATUTE_NOT_FOUND`.

---

## 1.4 페이지네이션

Query:

```
page    기본 0
size    기본 20, 최대 100
```

응답:

```
{
  "items": [],
  "page": {
    "number": 0,
    "size": 20,
    "totalElements": 292,
    "totalPages": 15,
    "hasNext": true
  }
}
```

---

## 1.5 상태값 표현

프론트에서 표시 문자열을 하드코딩하지 않기 위해 상태값은 다음 형태로 응답한다.

```
{
  "code": "AVAILABLE",
  "label": "가능"
}
```

분기는 `code`, 화면 표시는 `label`을 사용한다.

---

## 1.6 Idempotency-Key

부작용이 큰 업로드 요청에는 다음 헤더를 사용한다.

```
Idempotency-Key: 0199c8f2-...
```

적용 대상:

```
POST /api/v1/upload-batches
```

Idempotency-Key의 유효기간은 최초 요청 후 24시간이다.

유효기간 안에 동일 사용자와 동일 Idempotency-Key로 동일 요청이 재전송되면 새로운 Batch를 생성하지 않고 최초 응답을 재사용한다.

```
버튼 연타
네트워크 timeout 후 재시도
브라우저의 동일 요청 재전송
```

등을 방어하기 위한 용도다.

동일 Idempotency-Key로 다른 payload를 전송하면:

```
409 IDEMPOTENCY_KEY_REUSED
```

최초 요청으로 생성된 Batch가 유효기간 안에 삭제되면 해당 키를 삭제하지 않고 `DELETED` 상태로 남긴다.

같은 키와 같은 payload가 다시 전송되면:

```
410 IDEMPOTENCY_RESULT_DELETED
```

를 반환한다. 삭제된 Batch를 다시 업로드하려는 새로운 사용자 작업은 새로운 Idempotency-Key를 사용한다.

24시간이 지나 키가 만료되면 같은 키도 새 요청으로 처리한다. 이때 `fileHash`, `naturalKey` 중복 규칙은 그대로 적용한다.

`Idempotency-Key`와 `fileHash`, `naturalKey`의 역할은 서로 다르다.

```
Idempotency-Key
→ 동일 HTTP 요청 중복 실행 방지

fileHash
→ 동일 원본 파일 재업로드 탐지

naturalKey
→ 서로 다른 파일 간 동일 거래 중복 계상 방지
```

24시간 보장 기간과 삭제 후 동작은 API 계약이다. 응답 기록을 Redis + TTL로 저장하는 것은 구현 세부사항이다.

---

# 2. Enum

## 2.1 판정 결과 `verdict`

| code | label |
| --- | --- |
| AVAILABLE | 가능 |
| UNAVAILABLE | 불가 |
| NEEDS_REVIEW | 확인 필요 |

`일부 인정`은 별도 verdict가 아니다.

```
verdict = AVAILABLE
finalAmount < transaction.amount
```

이면 안분, 상각, 한도 등이 적용된 것이다.

---

## 2.2 파서 거래 상태 `sourceStatus`

파서가 카드 명세서에서 판정한 원본 상태다.

| code | label |
| --- | --- |
| JUDGEABLE | 판정대상 |
| CANCELED_OFFSET | 취소상계 |
| EXCLUDED | 대상제외 |

`sourceStatus`는 파서가 결정하며 원본 이력으로 보존한다.

---

## 2.3 사용자 포함 상태 `userInclusion`

| code | 의미 |
| --- | --- |
| AUTO | 파서 결과를 그대로 사용 |
| INCLUDED | 사용자가 명시적으로 포함 |
| EXCLUDED | 사용자가 명시적으로 제외 |

기본값은 `AUTO`.

`CANCELED_OFFSET`은 사용자가 `INCLUDED`로 바꿀 수 없다.

최종 판정 대상 여부는 `sourceStatus`와 `userInclusion`을 함께 계산한다.

```
sourceStatus = JUDGEABLE
userInclusion = AUTO
→ 판정대상

sourceStatus = JUDGEABLE
userInclusion = EXCLUDED
→ 대상제외

sourceStatus = EXCLUDED
userInclusion = INCLUDED
→ 판정대상

sourceStatus = CANCELED_OFFSET
→ 항상 취소상계
```

이를 API 응답에서 `effectiveStatus`로 제공한다.

---

## 2.4 분류 상태

| code | label |
| --- | --- |
| CLASSIFIED | 분류 완료 |
| NEEDS_REVIEW | 분류 확인 필요 |

`merchantCategory = 미분류`이면 `NEEDS_REVIEW`.

---

## 2.5 Question 상태

| code | label |
| --- | --- |
| PENDING | 대기 |
| ANSWERED | 응답 |
| CANCELED | 취소 |

`CANCELED`는 사용자가 직접 선택하는 상태가 아니다.

재판정 결과 해당 Question이 더 이상 필요하지 않을 때 시스템이 변경한다.

---

## 2.6 ClassificationReview 상태

| code | label |
| --- | --- |
| PENDING | 대기 |
| RESOLVED | 해결 |

---

## 2.7 JudgmentRun 상태

| code | label |
| --- | --- |
| QUEUED | 대기 |
| RUNNING | 실행 중 |
| COMPLETED | 완료 |
| PARTIAL_FAILED | 부분 실패 |
| FAILED | 전체 실패 |

### 상태 의미

`COMPLETED`

모든 판정 대상 Transaction의 기술적 처리가 성공했다.

결과 중 `NEEDS_REVIEW`가 존재해도 `COMPLETED`다.

`PARTIAL_FAILED`

일부 Transaction의 판정 처리는 성공했고 일부가 기술적 오류로 실패했다.

`FAILED`

Run 자체를 실행할 수 없었거나 모든 대상 Transaction의 처리가 실패했다.

---

## 2.8 Judgment origin

API 응답에서는 다음 type으로 표현한다.

```
RUN
USER_FACT
CLASSIFICATION_REVIEW
OVERRIDE
```

DB에서는 polymorphic `originId`를 사용하지 않고 실제 FK 컬럼으로 저장한다.

---

## 2.9 기장의무

```
복식부기
간편장부
추계
```

---

## 2.10 카드사

```
국민
기업
```

---

## 2.11 소스 유형

```
승인내역
청구내역
판별불가
```

업로드 API에서 허용되는 값은 현재 `승인내역`뿐이다.

나머지는:

```
422 INVALID_SOURCE_TYPE
```

---

## 2.12 가맹점 카테고리

허용값은 `rules/categories.yaml`의 카테고리(현재 32종) + `미분류`다.

`rules/categories.yaml`이 카테고리 어휘의 단일 원본이며 `docs/categories.md`도 이 목록에서 생성된다. 카테고리를 추가·변경할 때는 이 목록만 갱신한다.

분류에 실패한 거래에는 `미분류`를 부여한다. `미분류`는 이 파일에 없는 별도 센티넬 값이며, RuleCard의 match 대상이 될 수 없다.

---

## 2.13 Gate

```
G0
G1
G2
G3
G4
G5
G6
```

`blockedAtGate`에서 사용한다.

차단된 경우에만 값이 존재하며 아니면 null이다.

---

# 3. 엔드포인트

## 3.1 사용자

### `GET /api/v1/users/me`

```
{
  "id": "0199c8f2-...",
  "email": "user@example.com",
  "createdAt": "2026-09-01T10:00:00+09:00"
}
```

### `DELETE /api/v1/users/me`

응답:

```
204
```

---

# 3.2 사업자 Context

### `POST /api/v1/users/me/contexts`

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| industryCode | string | Y | 최대 6자 |
| prevYearRevenue | integer | Y | 0 이상 |
| businessOpenDate | date | Y |  |
| bookkeepingDuty | enum | Y | 복식부기/간편장부/추계 |
| hasEmployee | boolean | Y |  |
| homeOfficeRatio | integer | N | 0~100 |

응답 `201`:

```
{
  "id": "0199c8f2-...",
  "version": 4
}
```

Context는 수정하지 않고 새 버전을 생성한다.

### `GET /api/v1/users/me/contexts/current`

현재 최신 Context를 반환한다.

```
{
  "id": "0199d3a1-...",
  "userId": "0199c8f2-...",
  "version": 4,
  "industryCode": "62010",
  "prevYearRevenue": 48000000,
  "businessOpenDate": "2024-03-02",
  "bookkeepingDuty": "간편장부",
  "hasEmployee": false,
  "homeOfficeRatio": 20,
  "createdAt": "2026-09-01T10:00:00+09:00"
}
```

`bookkeepingDuty`는 §2.9 enum 문자열 그대로다(coded 아님). `homeOfficeRatio`는 미입력 시 `null`.

문진 전이면:

```
404 CONTEXT_NOT_FOUND
```

### `GET /api/v1/users/me/contexts`

Context 버전 이력을 `version` 오름차순 배열로 반환한다. 각 항목은 `current`와 같은 형태다.

페이지네이션 없음. 응답은 페이지 래퍼 없이 배열 자체다.

```
[
  { "id": "0199d3a1-...", "version": 1, "...": "..." },
  { "id": "0199d3b2-...", "version": 2, "...": "..." }
]
```

---

# 3.3 업로드

## `POST /api/v1/upload-batches`

헤더:

```
Idempotency-Key: {uuid}
```

요청:

| 필드 | 타입 | 필수 |
| --- | --- | --- |
| sourceType | enum | Y |
| cardIssuer | enum | Y |
| periodStart | date | Y |
| periodEnd | date | Y |
| fileHash | string | Y |
| transactions | array | Y |

`fileHash`는 프론트에서 원본 파일을 기준으로 계산한다.

서버는 원본 파일을 받지 않으므로 fileHash를 재계산하지 않는다.

### `transactions[]`

프론트 파서가 생성한 값을 서버가 받는다.

| 필드 | 타입 | 필수 | 비고 |
| --- | --- | --- | --- |
| approvedAt | date | Y | 승인일 |
| merchantRaw | string | Y | 파서가 전달한 원본 표시값 |
| amount | integer | Y |  |
| naturalKey | string | Y | 프론트 파서가 계산 |
| status | enum | Y | 파서의 sourceStatus |
| installmentMonths | integer | N | 기본 0 |
| approvalNo | string | N | naturalKey 재료 |
| bizNo | string | N |  |
| branch | string | N |  |
| branchRaw | string | N |  |
| memo | string | N |  |
| isAggregated | boolean | N |  |
| needsReview | boolean | N | 파서 단계 확인 필요 여부 |
| reviewReason | string | N |  |
| sourceCard | string | N |  |

요청 예시:

```
{
  "sourceType": "승인내역",
  "cardIssuer": "국민",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "fileHash": "sha256:abc...",
  "transactions": [
    {
      "approvedAt": "2026-01-03",
      "merchantRaw": "스타벅스코리아 서면점",
      "amount": 11000,
      "naturalKey": "74af71c3d9e2b018",
      "status": "JUDGEABLE",
      "installmentMonths": 0,
      "approvalNo": "78968731",
      "bizNo": "1234567890",
      "branch": "서면점",
      "branchRaw": "",
      "memo": "",
      "isAggregated": false,
      "needsReview": false,
      "reviewReason": "",
      "sourceCard": "kb"
    }
  ]
}
```

### 가맹점 분류

서버는 Transaction 저장 과정에서:

```
merchantNorm
merchantCategory
```

를 생성한다.

분류에 성공하면 정상 카테고리를 저장한다.

분류에 실패한 거래는 업로드 전체를 실패시키지 않는다.

```
merchantCategory = 미분류
classificationStatus = NEEDS_REVIEW
```

로 저장하고 `ClassificationReview`를 생성한다.

`미분류` 거래는 Rule Engine에 전달하지 않는다.

### 응답 `201`

```
{
  "id": "0199c8f2-...",
  "transactionCount": 289,
  "skippedDuplicateCount": 3,
  "classificationPendingCount": 4,
  "createdAt": "2026-09-18T01:10:00+09:00"
}
```

### 중복 처리

`naturalKey` 중복은 Batch 전체 실패 사유가 아니다.

중복 Transaction만 건너뛴다.

중복 범위는 사용자 단위다.

```
UNIQUE(user_id, natural_key)
```

동일 파일 재업로드는:

```
UNIQUE(user_id, file_hash)
```

로 차단한다.

### 에러

```
400 IDEMPOTENCY_KEY_REQUIRED

409 DUPLICATE_FILE
409 IDEMPOTENCY_KEY_REUSED

410 IDEMPOTENCY_RESULT_DELETED

422 INVALID_SOURCE_TYPE
422 EMPTY_TRANSACTIONS
422 MISSING_NATURAL_KEY
```

`Idempotency-Key` 헤더가 없으면 `400 IDEMPOTENCY_KEY_REQUIRED`.

---

## `GET /api/v1/upload-batches`

Query:

```
page
size
```

정렬:

```
createdAt DESC
```

응답:

```
{
  "items": [
    {
      "id": "0199aa11-...",
      "sourceType": "승인내역",
      "cardIssuer": "국민",
      "periodStart": "2026-01-01",
      "periodEnd": "2026-01-31",
      "transactionCount": 289,
      "skippedDuplicateCount": 3,
      "classificationPendingCount": 4,
      "createdAt": "2026-09-18T01:10:00+09:00"
    }
  ],
  "page": {
    "number": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "hasNext": false
  }
}
```

---

## `GET /api/v1/upload-batches/{batchId}`

Batch 메타데이터와 거래 수 등을 반환한다. 목록 `items[]`와 같은 형태다.

```
{
  "id": "0199aa11-...",
  "sourceType": "승인내역",
  "cardIssuer": "국민",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "transactionCount": 289,
  "skippedDuplicateCount": 3,
  "classificationPendingCount": 4,
  "createdAt": "2026-09-18T01:10:00+09:00"
}
```

에러:

```
404 BATCH_NOT_FOUND
```

---

## `DELETE /api/v1/upload-batches/{batchId}`

응답:

```
204
```

없는 배치면 `404 BATCH_NOT_FOUND`.

사용자가 Batch를 삭제하는 것은 해당 업로드와 그로부터 파생된 데이터를 삭제하려는 의도로 해석한다.

따라서 다음 Batch 종속 데이터도 함께 삭제한다.

```
UploadBatch
Transaction
ClassificationReview
JudgmentRun
JudgmentRunItem
Judgment
JudgmentCitation
Question
Batch-scoped UserFact
JudgmentOverride
```

공용 `StatuteVersion` 등 Batch와 독립된 기준 데이터는 삭제하지 않는다.

---

# 3.4 거래

## `GET /api/v1/transactions`

Query:

```
batchId
year
month
status
classificationStatus
verdict
page
size
```

`status`는 `effectiveStatus` 기준이다.

응답:

```
{
  "items": [
    {
      "id": "0199c8f2-...",
      "batchId": "0199aa11-...",
      "approvedAt": "2026-01-03",
      "merchantRaw": "AWS APN1",
      "merchantNorm": "Amazon Web Services",
      "merchantCategory": "해외SaaS",
      "classificationStatus": {
        "code": "CLASSIFIED",
        "label": "분류 완료"
      },
      "amount": 137000,
      "installmentMonths": 0,

      "sourceStatus": {
        "code": "JUDGEABLE",
        "label": "판정대상"
      },

      "userInclusion": "AUTO",

      "effectiveStatus": {
        "code": "JUDGEABLE",
        "label": "판정대상"
      }
    }
  ],
  "page": {
    "number": 0,
    "size": 20,
    "totalElements": 289,
    "totalPages": 15,
    "hasNext": true
  }
}
```

정렬:

```
approvedAt DESC, id DESC
```

---

## `GET /api/v1/transactions/{transactionId}`

```
{
  "id": "0199c8f2-...",
  "batchId": "0199aa11-...",
  "approvedAt": "2026-01-03",
  "merchantRaw": "AWS APN1",
  "merchantNorm": "Amazon Web Services",
  "merchantCategory": "해외SaaS",

  "classificationStatus": {
    "code": "CLASSIFIED",
    "label": "분류 완료"
  },

  "amount": 137000,
  "installmentMonths": 0,

  "sourceStatus": {
    "code": "JUDGEABLE",
    "label": "판정대상"
  },

  "userInclusion": "AUTO",

  "effectiveStatus": {
    "code": "JUDGEABLE",
    "label": "판정대상"
  }
}
```

---

## `POST /api/v1/transactions/{transactionId}/exclude`

사용자가 해당 거래를 판정 대상에서 제외한다.

```
userInclusion = EXCLUDED
```

응답:

```
{
  "id": "0199c8f2-...",
  "userInclusion": "EXCLUDED",
  "effectiveStatus": {
    "code": "EXCLUDED",
    "label": "대상제외"
  }
}
```

기존 Judgment는 이력 보존을 위해 삭제하지 않는다.

단, `batchId`, `year`를 이용한 현재 결과 및 summary에서는 해당 Transaction을 제외한다.

---

## `POST /api/v1/transactions/{transactionId}/include`

사용자가 해당 거래를 판정 대상에 포함한다.

```
userInclusion = INCLUDED
```

응답:

```
{
  "id": "0199c8f2-...",
  "userInclusion": "INCLUDED",
  "effectiveStatus": {
    "code": "JUDGEABLE",
    "label": "판정대상"
  }
}
```

파서가 `EXCLUDED`로 판단했던 거래도 사용자가 명시적으로 복구할 수 있다.

단:

```
sourceStatus = CANCELED_OFFSET
```

인 거래는 사용자가 포함시킬 수 없다.

에러:

```
409 CANCELED_TRANSACTION_NOT_INCLUDABLE
```

include/exclude 자체는 새 Judgment revision을 만들지 않는다.

필요한 경우 이후 `POST /judgment-runs`로 Batch를 다시 판정한다.

---

# 3.5 가맹점 분류 확인

RuleCard Question과 별도 리소스다.

## `GET /api/v1/classification-reviews`

Query:

```
batchId
status
grouped
page
size
```

정렬:

```
createdAt ASC, id ASC
```

### grouped=false (기본)

Review 개별 항목을 반환한다.

```
{
  "items": [
    {
      "id": "0199c1...",
      "batchId": "0199aa11-...",
      "transactionId": "0199f1...",
      "merchantRaw": "XYZ PAYMENTS",
      "merchantNorm": "XYZ PAYMENTS",
      "status": {
        "code": "PENDING",
        "label": "대기"
      },
      "suggestedCategories": [
        "해외SaaS",
        "온라인쇼핑",
        "기타"
      ],
      "createdAt": "2026-09-18T01:10:00+09:00",
      "resolvedAt": null
    }
  ],
  "page": {}
}
```

### grouped=true

동일 `merchantNorm` 또는 분류 키를 갖는 Review를 한 카드로 묶어 표시할 수 있다.

```
{
  "items": [
    {
      "groupKey": "merchant:XYZ PAYMENTS",
      "reviewIds": [
        "0199c1...",
        "0199c2...",
        "0199c3..."
      ],
      "count": 3,
      "totalAmount": 147000,
      "merchantRaw": "XYZ PAYMENTS",
      "suggestedCategories": [
        "해외SaaS",
        "온라인쇼핑",
        "기타"
      ]
    }
  ],
  "page": {}
}
```

`count`는 `reviewIds.length`와 항상 같아야 한다.

---

## `POST /api/v1/classification-responses`

```
{
  "reviewIds": [
    "0199c1...",
    "0199c2...",
    "0199c3..."
  ],
  "merchantCategory": "해외SaaS"
}
```

처리:

```
ClassificationReview → RESOLVED
Transaction.merchantCategory → 해외SaaS
classificationStatus → CLASSIFIED
```

응답:

```
{
  "resolvedCount": 3,
  "merchantCategory": "해외SaaS",
  "judgedCount": 3
}
```

### 판정 처리

해당 Batch에 아직 JudgmentRun 이력이 없다면 분류만 확정하고:

```
judgedCount = 0
```

으로 응답한다.

이후 최초 `POST /judgment-runs`에서 판정한다.

이미 해당 Batch에 완료된 JudgmentRun이 있다면 최근 Run에서 사용한 Context 버전을 사용해 해결된 Transaction만 판정할 수 있다.

이 경우 생성된 Judgment의 origin은:

```
CLASSIFICATION_REVIEW
```

이다.

분류 응답 자체는 룰엔진 `UserFact`로 저장하지 않는다.

에러:

```
404 CLASSIFICATION_REVIEW_NOT_FOUND

409 CLASSIFICATION_ALREADY_RESOLVED

422 INVALID_MERCHANT_CATEGORY
422 UNCLASSIFIED_CATEGORY_NOT_ALLOWED
422 REVIEWS_FROM_DIFFERENT_BATCHES
```

`reviewIds`가 서로 다른 배치에 걸쳐 있으면 `422 REVIEWS_FROM_DIFFERENT_BATCHES`.

`merchantCategory = 미분류`를 사용자 답변으로 제출할 수 없다.

---

# 3.6 판정 실행

## `POST /api/v1/judgment-runs`

```
{
  "batchId": "0199c8f2-...",
  "contextId": "0199d3a1-..."
}
```

Run은 해당 시점에서 다음 조건을 모두 만족하는 Transaction만 대상으로 한다.

```
effectiveStatus = JUDGEABLE
classificationStatus = CLASSIFIED
```

`미분류`, `CANCELED_OFFSET`, `EXCLUDED` 거래는 `totalCount`에 포함하지 않는다.

응답 `202`:

```
{
  "id": "0199e5b2-...",
  "batchId": "0199c8f2-...",
  "contextId": "0199d3a1-...",
  "contextVersion": 4,

  "status": {
    "code": "QUEUED",
    "label": "대기"
  },

  "totalCount": 275
}
```

에러:

```
404 BATCH_NOT_FOUND
404 CONTEXT_NOT_FOUND
```

### 재실행

같은 Batch에 여러 JudgmentRun을 실행할 수 있다.

새 Run이 기존 Transaction을 다시 판정하면 기존 Judgment를 수정하지 않고 새 revision을 생성한다.

```
T1 rev1 ← Run R1
T1 rev2 ← Run R2
```

각 revision은 자신을 실제 생성한 Run만 참조한다.

---

## `GET /api/v1/judgment-runs/{runId}`

```
{
  "id": "0199e5b2-...",
  "batchId": "0199c8f2-...",
  "contextId": "0199d3a1-...",
  "contextVersion": 4,

  "status": {
    "code": "RUNNING",
    "label": "실행 중"
  },

  "totalCount": 275,
  "processedCount": 117,
  "failedCount": 0,

  "startedAt": "2026-09-12T14:01:00+09:00",
  "completedAt": null
}
```

`processedCount`는 성공적으로 처리가 끝난 Transaction 수다.

`NEEDS_REVIEW` Judgment도 성공적으로 처리된 것으로 센다.

없는 Run이면 `404 JUDGMENT_RUN_NOT_FOUND`. 아래 `/failures`도 같다.

---

## `GET /api/v1/judgment-runs/{runId}/failures`

Run에서 기술적으로 처리하지 못한 Transaction을 조회한다.

Query:

```
page
size
```

응답:

```
{
  "items": [
    {
      "transactionId": "0199f1...",
      "errorCode": "RULE_PROCESSING_FAILED",
      "message": "판정 처리 중 오류가 발생했습니다.",
      "failedAt": "2026-09-12T14:01:02+09:00"
    }
  ],
  "page": {
    "number": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "hasNext": false
  }
}
```

내부적으로는 다음과 같은 `judgment_run_item`을 사용한다.

```
judgment_run_item
- run_id
- transaction_id
- status
- error_code
- error_message
```

Run Item status:

```
SUCCEEDED
FAILED
```

`NEEDS_REVIEW`는 `SUCCEEDED`다.

---

# 3.7 판정 결과

## 현재 결과와 Run 결과

두 조회의 의미를 구분한다.

```
batchId / year
→ Transaction별 현재 Judgment

runId
→ 해당 Run이 실제 생성한 historical Judgment
```

---

## `GET /api/v1/judgments`

Query:

```
transactionId
batchId
year
verdict
latestOnly
runId
page
size
```

`latestOnly` 기본값:

```
true
```

`latestOnly=true`는 현재 결과 호환 이름이다. 활성 Override가 최신 revision이 아니어도 현재 Judgment로 반환한다.

### batchId / year

```
GET /api/v1/judgments?batchId=B1
```

현재 유효한 Transaction마다 현재 Judgment만 반환한다.

활성 JudgmentOverride가 있으면 해당 Override revision이 현재 Judgment다. 활성 Override가 없으면 latest non-override revision이 현재 Judgment다.

사용자가 현재 `EXCLUDED`한 Transaction은 제외한다.

```
GET /api/v1/judgments?year=2026
```

해당 연도의 현재 유효한 Transaction마다 현재 Judgment를 반환한다.

### transactionId

```
GET /api/v1/judgments?transactionId=T1&latestOnly=false
```

해당 Transaction의 전체 revision 이력을 조회할 수 있다.

### runId

```
GET /api/v1/judgments?runId=R1
```

R1이 직접 생성했던 Judgment만 반환한다.

R1 이후 QuestionResponse나 Override로 생성된 revision은 포함하지 않는다.

`runId`와 `latestOnly`는 함께 사용하지 않는다.

정렬:

```
computedAt DESC, id DESC
```

응답:

```
{
  "items": [
    // 각 항목은 GET /api/v1/judgments/{judgmentId} 응답과 같은 형태
  ],
  "page": {}
}
```

`latestOnly=false`로 특정 Transaction 이력을 조회하면 한 Transaction의 여러 revision이 함께 반환된다.

---

## `GET /api/v1/judgments/summary`

현재 결과 집계:

```
GET /api/v1/judgments/summary?batchId=B1
```

```
GET /api/v1/judgments/summary?year=2026
```

과거 Run 집계:

```
GET /api/v1/judgments/summary?runId=R1
```

`batchId`, `year`, `runId` 중 정확히 하나를 사용한다. 0개거나 2개 이상이면 `400 INVALID_SUMMARY_SCOPE`.

현재 결과인 `batchId`, `year` 집계는 각 Transaction의 현재 Judgment 기준이다.

현재 대상에서 제외된 Transaction은 집계하지 않는다.

응답:

```
{
  "scope": {
    "type": "BATCH",
    "id": "0199c8f2-..."
  },

  "totalCount": 272,

  "byVerdict": {
    "AVAILABLE": {
      "count": 180,
      "finalAmount": 4820000
    },
    "UNAVAILABLE": {
      "count": 62,
      "finalAmount": 0
    },
    "NEEDS_REVIEW": {
      "count": 30,
      "finalAmount": 0
    }
  },

  "byAccount": [
    {
      "account": "소모품비",
      "count": 42,
      "finalAmount": 1820000
    }
  ]
}
```

---

## `GET /api/v1/judgments/{judgmentId}`

```
{
  "id": "0199f1c3-...",
  "transactionId": "0199c8f2-...",
  "revision": 2,

  "origin": {
    "type": "USER_FACT",
    "id": "0199fact-..."
  },

  "verdict": {
    "code": "AVAILABLE",
    "label": "가능"
  },

  "outOfScope": false,
  "blockedAtGate": null,
  "account": "소모품비",
  "finalAmount": 1200000,

  "isInference": false,
  "unmatchedReason": null,

  "attributes": {
    "자산": false
  },

  "ruleCardId": "R-310",
  "ruleCardVersion": 3,
  "appliedRuleIds": [
    "R-310",
    "R-504"
  ],
  "rulesCommitSha": "abc123...",
  "userContextVersion": 4,

  "explanation": "사업 수행에 직접 사용한 비용으로 분류되었습니다.",

  "computedAt": "2026-09-12T14:05:00+09:00",

  "citations": [
    {
      "statuteVersionId": 1523,
      "statuteId": "소득세법시행령-67-4"
    }
  ]
}
```

없는 판정이면 `404 JUDGMENT_NOT_FOUND`.

### 주요 필드

| 필드 | 설명 |
| --- | --- |
| revision | Transaction 재판정마다 증가 |
| origin | 이 revision이 생성된 직접 원인 |
| outOfScope | 룰엔진 판정 범위 밖(핸드오프)인지. `verdict = NEEDS_REVIEW`일 때만 `true`일 수 있고 그 외 verdict에서는 항상 `false` |
| account | 계정과목 |
| finalAmount | 안분, 상각, 한도 적용 후 인정 금액 |
| isInference | 룰로 확정하지 못해 fallback 결과인지 |
| unmatchedReason | 매칭 실패 원인 |
| attributes | 판정 과정에서 생성된 속성 |
| ruleCardId | 대표 적용 RuleCard |
| ruleCardVersion | 대표 RuleCard 버전 |
| appliedRuleIds | 적용된 전체 RuleCard ID |
| rulesCommitSha | 사용된 Rules revision |
| userContextVersion | 판정에 사용된 Context 버전 |
| explanation | RuleCard의 reason |
| citations | 근거 법령 |

### Judgment `state` 제거

기존:

```
PROVISIONAL
FINALIZED
```

는 개별 Judgment에서 제거한다.

잠정/확정은 연간 수입금액과 G6 한도 집계 결과의 상태다.

따라서:

```
Judgment
→ verdict 및 revision 관리

LimitBucketEntry / 연간 집계
→ PROVISIONAL / FINALIZED 관리
```

로 책임을 분리한다.

---

# 3.8 Judgment Override

## `POST /api/v1/judgments/{judgmentId}/override`

사용자가 이미 생성된 판정이 잘못되었다고 판단했을 때 사용한다.

Question 응답과 다른 기능이다.

```
QuestionResponse
→ 엔진이 요구한 추가 사실 제공

JudgmentOverride
→ 사용자가 판정 결과 자체를 수동으로 수정
```

요청:

```
{
  "toVerdict": "UNAVAILABLE",
  "reason": "개인적으로 사용한 비용입니다."
}
```

처리:

```
기존 Judgment는 그대로 보존
JudgmentOverride 생성
새 Judgment revision 생성
같은 Transaction의 기존 활성 JudgmentOverride 비활성화
```

새 JudgmentOverride는 즉시 활성 상태가 되며 사용자가 해제하기 전까지 현재 결과보다 우선한다.

이후 JudgmentRun, Question 응답, 분류 응답이 새 자동 판정 revision을 생성해도 활성 Override는 유지된다. 자동 판정 revision은 이력과 `runId` 결과에는 정상적으로 포함된다.

응답 `200`:

새 Judgment 객체.

예시:

```
{
  "id": "0199-new-judgment...",
  "transactionId": "0199c8f2-...",
  "revision": 3,

  "origin": {
    "type": "OVERRIDE",
    "id": "0199override-..."
  },

  "verdict": {
    "code": "UNAVAILABLE",
    "label": "불가"
  },

  "computedAt": "2026-09-18T01:30:00+09:00"
}
```

`JudgmentOverride`는 다음 정보를 보존한다.

```
id
source_judgment_id
to_verdict
reason
active
created_at
released_at
```

`override_log`보다는 행위 자체를 나타내는 `judgment_override`라는 이름을 사용한다.

## `DELETE /api/v1/judgment-overrides/{overrideId}`

활성 JudgmentOverride를 해제한다.

응답:

```
204
```

Override 및 Override가 생성한 Judgment revision은 삭제하지 않는다. `active=false`, `releasedAt`을 기록하고, 해당 Transaction의 latest non-override revision을 현재 결과로 사용한다.

이미 해제된 Override에 대한 DELETE도 `204`를 반환한다.

에러:

```
404 JUDGMENT_OVERRIDE_NOT_FOUND
```

---

# 3.9 룰엔진 확인 질문

## `GET /api/v1/questions`

Question은 RuleCard 실행 중 추가 사실이 필요할 때 생성된다.

ClassificationReview와 구분한다.

Query:

```
batchId
transactionId
status
grouped
page
size
```

`runId`를 현재 질문 조회의 기준으로 사용하지 않는다.

Question은 이후 revision에서도 추가될 수 있기 때문이다.

정렬:

```
createdAt ASC, id ASC
```

### grouped=false (기본)

Question 개별 항목을 반환한다. `unresolved` 집계는 grouped 여부와 무관하게 항상 최상위에 포함한다(아래 "미해소 집계" 참고).

```
{
  "items": [
    {
      "id": "0199a1...",
      "batchId": "0199aa11-...",
      "transactionId": "0199f1...",
      "groupKey": "merchant:스타벅스",
      "factType": "용도",
      "questionText": "이 가맹점에서 사용한 비용은 주로 어떤 목적으로 지출하셨나요?",
      "options": [
        "사업",
        "개인",
        "혼용"
      ],
      "status": {
        "code": "PENDING",
        "label": "대기"
      },
      "answeredFactId": null,
      "createdAt": "2026-09-12T14:05:00+09:00",
      "answeredAt": null
    }
  ],
  "unresolved": {
    "count": 24,
    "amount": 340000
  },
  "page": {}
}
```

### grouped=true

```
{
  "items": [
    {
      "groupKey": "merchant:스타벅스",
      "factType": "용도",

      "questionIds": [
        "0199a1...",
        "0199a2...",
        "0199a3..."
      ],

      "count": 3,
      "totalAmount": 33000,

      "questionText": "이 가맹점에서 사용한 비용은 주로 어떤 목적으로 지출하셨나요?",

      "options": [
        "사업",
        "개인",
        "혼용"
      ]
    }
  ],

  "page": {}
}
```

`count`는 반드시 `questionIds.length`와 같다.

Question grouping은 RuleCard의 `group_by`를 따른다.

```
transaction
merchant_norm
```

같은 `groupKey`라도 `factType`이 다르면 별도 그룹이다.

### 미해소 집계

`items`, `page`와 별도로 응답 최상위에 미해소 집계를 포함한다.

```json
{
  "items": [],
  "unresolved": {
    "count": 24,
    "amount": 340000
  },
  "page": {}
}
```

| 필드 | 뜻 |
| --- | --- |
| `count` | 페이지네이션 전 `PENDING` Question 수 |
| `amount` | `PENDING` Question이 참조하는 Transaction 금액 합계(원) |

집계에는 `batchId`, `transactionId` 필터를 적용하지만 `status`, `grouped`, `page`, `size`는 적용하지 않는다. 따라서 `page.totalElements`와 `unresolved.count`는 다를 수 있다.

`amount`는 거래 단위 합계다. 동일 Transaction이 여러 Question에 걸린 경우 한 번만 합산한다.

프론트가 "확인 필요 24건 · 340,000원"을 표시하기 위한 값이다.

---

# 3.10 Question 응답

## `POST /api/v1/question-responses`

```
{
  "questionIds": [
    "0199a1...",
    "0199a2...",
    "0199a3..."
  ],

  "answer": {
    "value": "사업"
  }
}
```

같은 요청의 Question은 동일 Batch, `groupKey`, `factType`에 속해야 한다.

처리 순서:

```
1. Question 검증
2. batch-scoped UserFact의 새 version 생성
3. Question → ANSWERED
4. 동일 Batch에서 Fact의 scope가 영향을 주는 Transaction 조회
5. 해당 Transaction만 재판정
6. 각 Transaction에 새 Judgment revision 저장
7. 기존 PENDING Question 중 더 이상 필요 없는 Question → CANCELED
8. 새로운 Question이 필요한 경우 새 Question 생성
```

새로운 `JudgmentRun`은 생성하지 않는다.

응답:

```
{
  "answeredCount": 3,
  "factId": "0199fact-...",
  "rejudgedTransactionCount": 3
}
```

기존 명세의:

```
{
  "runId": "..."
}
```

는 제거한다.

### 답변 정정

`PENDING` Question은 최초 답변할 수 있고, `ANSWERED` Question은 같은 API로 정정할 수 있다.

정정할 때 기존 UserFact를 수정하지 않는다. 동일한 `(userId, batchId, scopeKey, factType)`에서 `version`을 증가시킨 UserFact를 새로 생성하고 Question의 `answeredFactId`를 새 UserFact로 변경한다.

`CANCELED` Question에는 응답할 수 없다.

### UserFact 범위

UserFact는 Batch 범위를 벗어나지 않는다.

개념적으로:

```
UserFact
- userId
- batchId
- scopeKey
- factType
- value
- version
```

예:

```
batchId = B1
scopeKey = merchant:스타벅스
factType = 용도
value = 사업
```

이면 B1 안의 스타벅스 Transaction만 영향을 받는다.

다른 Batch의 스타벅스 Transaction에는 자동 적용하지 않는다.

### 재판정 Context

Question이 발생한 원래 Judgment의 `userContextVersion`을 사용한다.

같은 grouped response에 포함되는 Question들은 동일 Batch와 동일 Context 기준이어야 한다.

### Judgment origin

Question 응답 때문에 생성된 모든 새 Judgment revision은 같은 UserFact를 참조할 수 있다.

```
Judgment.trigger_user_fact_id
→ UserFact.id
```

예:

```
UserFact F10

T1 rev2 → F10
T2 rev2 → F10
T3 rev2 → F10
```

에러:

```
404 QUESTION_NOT_FOUND

409 QUESTION_NOT_ANSWERABLE
409 QUESTION_GROUP_MISMATCH

422 INVALID_ANSWER_VALUE
422 QUESTIONS_FROM_DIFFERENT_BATCHES
```

---

# 3.11 Question 일괄 응답

## `POST /api/v1/questions/bulk-answer`

남은 소액 질문을 한 번에 닫는다. "남은 12건 전부 개인용" 같은 경우에 사용한다.

연간 확정 조건이 `PENDING` Question 0을 요구하므로, 꼬리 질문을 한 건씩 묻는 대신 일괄로 닫을 수단이 필요하다.

요청:

```json
{
  "batchId": "0199c8f2-...",
  "factType": "용도",
  "answer": {
    "value": "개인"
  }
}
```

| 필드 | 타입 | 필수 | 비고 |
| --- | --- | --- | --- |
| batchId | UUID | Y | 이 Batch의 `PENDING` Question만 대상 |
| factType | string | Y | RuleCard `question.fact_type` 값 |
| answer.value | string | Y | 대상 Question의 `options`에 포함되는 값 |

대상은 다음을 모두 만족하는 Question이다.

```
batchId 일치
status = PENDING
factType 일치
```

모든 대상 Question이 `answer.value`를 허용해야 한다. 하나라도 허용하지 않으면 아무것도 변경하지 않고 `422 INVALID_ANSWER_VALUE`를 반환한다.

각 `(scopeKey, factType)`마다 UserFact를 하나 생성하고, 영향받는 Transaction만 재판정해 새 Judgment revision을 만든다. 동일 Transaction이 여러 Question에 걸려도 한 번만 재판정한다. 새 `JudgmentRun`은 생성하지 않는다.

`factType`이 다른 Question은 변경하지 않는다.

응답 `200`:

```json
{
  "answeredCount": 12,
  "skippedCount": 3,
  "factIds": [
    "0199fact-..."
  ],
  "rejudgedTransactionCount": 12,
  "unresolved": {
    "count": 9,
    "amount": 128000
  }
}
```

| 필드 | 뜻 |
| --- | --- |
| answeredCount | `ANSWERED`로 전환된 질문 수 |
| skippedCount | 요청 당시 해당 Batch의 `PENDING` 중 factType이 달라 건너뛴 수 |
| factIds | 생성된 UserFact ID. scopeKey가 다르면 여러 개 |
| rejudgedTransactionCount | 중복을 제거한 재판정 Transaction 수 |
| unresolved | 처리 후 해당 Batch에 남은 미해소 집계. 3.9와 같은 형태 |

일괄 처리한 답변은 3.10의 `POST /question-responses`로 개별 정정할 수 있다.

에러:

```
404 BATCH_NOT_FOUND
422 INVALID_ANSWER_VALUE
422 UNKNOWN_FACT_TYPE
```

해당 factType의 Question 이력은 있지만 `PENDING` 대상이 0건이면 에러가 아니다. `answeredCount = 0`으로 응답한다.

---

# 3.12 Question 취소

사용자가 Question을 직접 취소하는 API는 제공하지 않는다.

`CANCELED`는 시스템 전용 상태다.

예:

```
rev1
→ Q1 발생

다른 UserFact 입력
→ 재판정

rev2
→ Q1이 더 이상 필요하지 않음

Q1.status = CANCELED
```

Question을 삭제하지 않고 상태를 남겨 판정 이력을 보존한다.

---

# 3.13 법령

## `GET /api/v1/statutes/{statuteVersionId}`

```
{
  "statuteVersionId": 1523,
  "statuteId": "소득세법시행령-67-4",
  "title": "소득세법 시행령 제67조 제4항",

  "hierarchy": "시행령",

  "effectiveFrom": "2026-01-01",
  "effectiveTo": null,

  "sourceUrl": "https://www.law.go.kr/...",
  "body": "..."
}
```

법률, 시행령, 기본통칙, 판례 등의 표시를 구분할 수 있도록 `hierarchy`를 반환한다.

없는 법령이면 `404 STATUTE_NOT_FOUND`.

---

# 4. Judgment revision origin 저장

API에서는:

```
{
  "origin": {
    "type": "USER_FACT",
    "id": "..."
  }
}
```

처럼 하나의 공통 형태로 제공한다.

DB에서는 `origin_type + origin_id` polymorphic 관계를 사용하지 않는다.

실제 FK를 둔다.

```
judgment

id
transaction_id
revision

run_id                       nullable FK
trigger_user_fact_id         nullable FK
classification_review_id     nullable FK
judgment_override_id         nullable FK

...
```

관계:

```
judgment.run_id
→ judgment_run.id

judgment.trigger_user_fact_id
→ user_fact.id

judgment.classification_review_id
→ classification_review.id

judgment.judgment_override_id
→ judgment_override.id
```

모든 Judgment revision은 정확히 하나의 직접 origin을 가져야 한다.

PostgreSQL 예시:

```
CHECK (
    num_nonnulls(
        run_id,
        trigger_user_fact_id,
        classification_review_id,
        judgment_override_id
    ) = 1
)
```

### origin 예시

최초 또는 명시적 Batch 판정:

```
rev1
run_id = R1
```

Question 답변:

```
rev2
trigger_user_fact_id = F7
```

분류 확인 후 부분 판정:

```
rev1
classification_review_id = C3
```

사용자 Override:

```
rev3
judgment_override_id = O2
```

`sourceRunId`는 별도 저장하지 않는다.

필요하면 Transaction의 revision 이력에서 최초 Run을 추적할 수 있다.

---

# 5. 현재 결과 계산 규칙

Transaction의 현재 결과에 포함되려면:

```
effectiveStatus = JUDGEABLE
AND classificationStatus = CLASSIFIED
AND 현재 Judgment가 존재
```

해야 한다.

현재 Batch 결과:

```
각 Transaction
→ active Override가 있으면 해당 Override Judgment 선택
→ 없으면 latest non-override Judgment 선택
→ 현재 제외 거래 제거
→ 집계
```

Run 결과:

```
judgment.run_id = requestedRunId
```

인 Judgment만 집계한다.

따라서 Run 결과와 현재 결과가 서로 변하지 않는다.

자동 판정이 활성 Override보다 나중 revision이어도 현재 결과는 Override를 사용한다. `runId` 결과는 Override와 무관하게 해당 Run이 직접 생성한 Judgment만 사용한다.

예:

```
Run R1

T1 rev1 AVAILABLE
T2 rev1 NEEDS_REVIEW

Question 답변

T2 rev2 AVAILABLE
```

현재 결과:

```
T1 rev1
T2 rev2
```

R1 결과:

```
T1 rev1
T2 rev1
```

---

# 6. 삭제 정책

## Batch 삭제

```
DELETE /upload-batches/{batchId}
```

는 해당 업로드와 그 파생 결과 전체 삭제를 의미한다.

Batch 범위 데이터는 cascade한다.

해당 Batch를 생성한 Idempotency-Key가 아직 24시간 유효하면 키를 삭제하지 않고 `DELETED` 상태로 바꾼다. 남은 TTL 안에 같은 요청이 재전송되면 `410 IDEMPOTENCY_RESULT_DELETED`를 반환한다.

## Judgment revision 삭제

사용자가 특정 revision만 직접 삭제하는 API는 제공하지 않는다.

판정 이력은 append-only로 취급한다.

## Question / UserFact

Question은 직접 삭제하지 않는다.

Batch 삭제 시에만 함께 제거한다.

Batch-scoped UserFact도 Batch 삭제 시 제거한다.

## StatuteVersion

법령 원문은 특정 Batch의 데이터가 아니므로 삭제하지 않는다.

---

# 7. 내부 DB 변경 요약

## transaction

기존 `status` 하나만 사용하는 대신 최소한 다음 의미를 구분한다.

```
source_status
user_inclusion
```

`effectiveStatus`는 계산 값이다.

또한:

```
merchant_category = 미분류
```

를 허용한다.

---

## judgment_run

추가 필요:

```
id
batch_id
context_id
context_version
status
total_count
processed_count
failed_count
started_at
completed_at
```

---

## judgment_run_item

추가:

```
run_id
transaction_id
status
error_code
error_message
```

---

## judgment

추가 또는 유지:

```
transaction_id
revision

run_id
trigger_user_fact_id
classification_review_id
judgment_override_id

rule_card_id
rule_card_version
applied_rule_ids
rules_commit_sha
user_context_version

verdict
blocked_at_gate
account
final_amount
attributes
is_inference
unmatched_reason
computed_at
```

제거:

```
state
```

---

## user_fact

Batch scope 추가:

```
batch_id
```

개념적 unique:

```
(user_id, batch_id, scope_key, fact_type, version)
```

---

## classification_review

추가:

```
id
transaction_id
status
selected_category
created_at
resolved_at
```

---

## judgment_override

추가:

```
id
source_judgment_id
to_verdict
reason
active
created_at
released_at
```

---

## question_queue

유지:

```
judgment_id
answered_fact_id
reason_code
question_text
group_key
fact_type
options
status
created_at
answered_at
```

`status=CANCELED`는 시스템만 설정한다.

---

# 8. 주요 사용자 흐름

## 8.1 정상적인 최초 판정

```
카드 파일 선택
↓
프론트 파싱
↓
fileHash / naturalKey 계산
↓
POST /upload-batches
↓
Transaction 저장
↓
가맹점 분류
↓
POST /judgment-runs
↓
Transaction별 Judgment rev1
↓
AVAILABLE / UNAVAILABLE / NEEDS_REVIEW
```

---

## 8.2 분류 실패

```
Transaction 업로드
↓
가맹점 분류 실패
↓
merchantCategory = 미분류
↓
ClassificationReview PENDING
↓
Rule Engine에는 전달하지 않음
↓
사용자 분류 응답
↓
merchantCategory 확정
↓
ClassificationReview RESOLVED
```

이미 Batch 판정이 수행된 상태라면 해결된 거래만 부분 판정할 수 있다.

아직 판정을 수행하지 않았다면 다음 JudgmentRun에서 함께 판정한다.

---

## 8.3 룰엔진 Question

```
Judgment rev1
NEEDS_REVIEW
↓
Question 생성
↓
사용자 답변
↓
UserFact 생성
↓
같은 Batch의 영향 Transaction 탐색
↓
부분 재판정
↓
Judgment rev2
```

새 JudgmentRun은 생성하지 않는다.

---

## 8.4 사용자 판정 수정

```
Judgment rev2 AVAILABLE
↓
사용자가 잘못된 판정이라고 판단
↓
POST /judgments/{id}/override
↓
JudgmentOverride 생성
↓
Judgment rev3 UNAVAILABLE
↓
사용자가 해제하기 전까지 현재 결과로 유지
```

해제:

```
DELETE /judgment-overrides/{overrideId}
↓
JudgmentOverride active=false
↓
latest non-override Judgment가 현재 결과
```

---

## 8.5 사용자가 거래 제외

```
Transaction
↓
POST /transactions/{id}/exclude
↓
userInclusion = EXCLUDED
↓
현재 Judgment summary에서 제외
```

기존 Judgment revision은 삭제하지 않는다.

---

## 8.6 Batch 재판정

```
Context 수정
또는
포함/배제 수정
또는
명시적 전체 재계산

↓
POST /judgment-runs

↓
새 JudgmentRun

↓
각 Transaction에 새 Judgment revision
```

새 Run은 과거 Run을 덮어쓰지 않는다.

활성 JudgmentOverride가 있는 Transaction도 Run 이력은 새로 생성하지만 현재 결과는 Override를 유지한다.

---

# 9. 최종 책임 경계

```
Frontend Parser
→ 카드 원문 파싱
→ naturalKey
→ fileHash
→ sourceStatus

Backend Classification
→ merchantNorm
→ merchantCategory
→ ClassificationReview

JudgmentRun
→ Batch 단위 명시적 판정 실행

Rule Engine
→ transaction 단위 결정론적 Judgment
→ 필요 시 Question 생성

QuestionResponse
→ UserFact 저장
→ 같은 Batch만 부분 재판정

JudgmentOverride
→ 사용자 직접 판정 수정

Judgment Query
→ revision 및 현재 latest 결과 제공

Summary
→ batch/year latest 결과 집계
→ runId historical 결과 집계
```

이 구조에서는 가맹점 분류, 판정, 질문 응답, 사용자 수정, 일괄 실행이 서로 다른 책임을 가지며, 각 Judgment revision이 어떤 원인으로 생성되었는지도 추적할 수 있다.
