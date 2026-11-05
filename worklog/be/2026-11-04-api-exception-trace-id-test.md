# ApiException 응답의 traceId 도 요청 로그와 같은지 테스트로 고정한다

- 브랜치: feature/monitoring-logging
- 커밋: aff293a (1개)
- 주요파일: RequestTraceFilterTest.java

## 한 일

- `api_exception_trace_id_matches_header` 를 더했다. 서비스가 `ApiException`(404)을 던질 때 응답 헤더 `X-Trace-Id`, 에러 본문 `traceId`, 요청 로그의 traceId 가 같은지 본다.

## 왜 이렇게 했나

- 기존 테스트는 500 만 본다. 500 은 `handleUnexpected` → `error()` 로 나가고, 404·409 같은 전용 코드 에러는 `handleApiException` 으로 따로 나간다.
- #228 이 `handleApiException` 을 건드려서, 합칠 때 MDC 처리가 그쪽에 빠지면 대부분의 에러가 요청 로그와 다른 traceId 를 갖는다(#228 memoryhong 리뷰). 기존 테스트로는 이걸 잡지 못한다.

## 확인한 것

- `handleApiException` 이 MDC 를 건너뛰고 새 UUID 를 쓰게 일부러 바꾸면 새 테스트가 실패하는 것을 보고 되돌렸다.
- `gradlew -p backend check` 통과(unit 415, integration 276).

## 남은 것 · 아는 문제

- #228 과 합친 상태는 아직 돌려 보지 않았다. #228 은 traceId 를 만드는 곳을 `error(code, message, runId)` 하나로 모았으니, 뒤에 머지하는 쪽은 MDC 를 그 메서드에 넣는다.
