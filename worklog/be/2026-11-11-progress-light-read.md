# 진행 상황과 지난번 답 불러오기가 질문 전부를 무겁게 읽지 않게

- 브랜치: perf/progress-light-read
- 커밋: e0966c22..20a0480f (2개)
- 주요파일: ProgressService.java, QuestionSuggestionService.java, QuestionQueryService.java, QuestionQueueRepositoryCustomImpl.java

## 한 일

- 진행 상황(`/progress`)의 미해소 질문 집계를 질문 목록과 같은 SQL(`QuestionQueryService.unresolved`, `countPending`)로 센다. 전에는 업로드의 질문 전부에 거래, 답, 수정 여부, 최신 판정을 붙여 읽고 Java 에서 셌다.
- 지난번 답 불러오기(`QuestionSuggestionService.suggest`)가 PENDING 질문만 읽는다(`findPending`, `findPendingRows`). 전에는 답한 질문까지 무겁게 읽고 Java 에서 PENDING 만 남겼다. `/progress`와 `/questions/suggestions` 둘 다 이 경로를 쓴다.
- `QuestionSuggestionIntegrationTest`에 같은 업로드에서 이미 답한 질문은 지난번 답 목록에 나오지 않는 것을 더했다.

## 왜 이렇게 했나

- 운영 로그(11/9 17:49 배포 뒤 ~ 11/11): `/progress` 331번, p50 51ms, p95 1,409ms, 최대 3,259ms. 느린 것은 데이터가 큰 사용자 한 명뿐이었고(그 사용자 p95 1,590ms, 나머지 6명은 p95 40~111ms), 그 사용자에게는 `/questions`(p95 676ms)보다 느렸다. `/progress`가 질문 전부를 무겁게 두 번 읽었기 때문이다(미해소 집계 한 번, `suggest` 안에서 한 번).
- 11/8 에 `/questions`는 한 쪽만 읽고 집계는 SQL 로 바꿨는데 `/progress`와 `suggest`에는 같은 방식이 남아 있었다.
- 마감일(11/11 17시 이후 수정 불가)이라 리스크가 작은 범위만 했다. `suggest`는 계산(`PreviousAnswerSuggester`)을 그대로 두고 읽는 대상만 SQL 에서 PENDING 으로 좁혔다. `toDomain`의 `withPending`은 소명 대기 판정에만 쓰이고, PENDING 질문의 거래는 어느 쪽이든 그 집합에 들어가 값이 같다.
- 화면은 이 API 들을 대부분 기다리지 않는다(단계 표시의 완료 표시, 판정 완료 알림, 질문 화면의 지난번 답 표시는 나중에 붙는다). 기다리는 곳은 비서의 「다음에 뭐 해?」뿐이다. 그래서 체감 개선보다는 큰 데이터로 여럿이 쓸 때 서버(DB 연결, JVM 메모리) 여유가 주된 효과다.

## 확인한 것

- 백엔드 `gradlew check` 통과(단위 462, 통합 335, 실패 0, 건너뜀 8은 환경변수로만 도는 측정용 테스트).
- 새 테스트는 `findPendingRows`의 PENDING 조건을 빼면 실패한다(지난번 답 항목 3개가 아니라 4개).
- 로컬 측정(PC, Testcontainers Postgres, 커밋하지 않은 측정용 테스트). 실제 판정기와 답변 서비스로 지난 업로드 3,000건(모두 답함), 이번 업로드 6,000건(질문 3,267개, 대기 1,400, 답함 1,867)을 만들고 서비스를 직접 불러 3번 예열 뒤 7번 중앙값.

| | develop | 이 브랜치 |
| --- | --- | --- |
| `/progress` | 300ms, 할당 53MB | 167ms, 할당 19MB |
| `/questions/suggestions` | 121ms, 할당 37MB | 65ms, 할당 19MB |

- 두 버전의 값이 같았다: 미해소 1,400건과 금액, 지난번 답 항목 1,400개, 등급별 질문 수(B 461, C 939).

## 남은 것 · 아는 문제

- 측정 데이터에 A등급(지난번 답 그대로 채우기)이 생기지 않아 `fillableFromPrevious`는 0이었다. 그 경로의 값은 기존 통합 테스트(`ProgressIntegrationTest`, `QuestionSuggestionIntegrationTest`)가 본다.
- 여러 사용자가 1만 건으로 동시에 쓰는 상황, 운영 서버(t3.medium)에서의 시간은 재지 않았다. 배포하면 CloudWatch 로그로 같은 사용자의 `/progress` p95 를 다시 본다.
- `suggest`는 대기 질문을 여전히 무겁게(거래, 답, 수정 여부, 최신 판정) 읽는다. 계산이 쓰는 값(그룹 키, 질문 종류, 코드, 선택지, 가맹점, 소명 대기 여부)만 읽으면 더 준다. `QuestionGroup`이 완성된 `Question`을 받는 구조라 입력 형태를 바꿔야 해서 마감일에는 하지 않았다.
- 일괄 응답 뒤 미해소 집계(`QuestionAnswerService` 의 `PendingTotal.of(queryService.find(...))`)도 같은 무거운 방식이다. 바로 앞의 `flushAndClear` 흐름을 확인해야 해서 그대로 뒀다.
- 분류 확인 목록(`/classification-reviews`)은 요청 전부와 모든 거래의 모델 답을 읽고 메모리에서 자른다. 운영 로그상 수십 ms(11/8 정점의 1초대 두 건 제외)이고 호출도 적어 손대지 않았다.
