# 에러 본문의 traceId 를 error() 한 곳에서 만든다 (#228 리뷰)

- 브랜치: fix/run-active-conflict
- 커밋: 8c62fac (1개)
- 주요파일: ApiExceptionHandler.java

## 한 일

- `handleApiException` 이 `error(code, message, runId)` 를 거치게 했다. 따로 두었던 `traceId()` 는 지웠다. 이제 모든 에러 본문의 traceId 는 `error(..., runId)` 한 곳에서 만든다.

## 왜 이렇게 했나

- memoryhong 리뷰: #225 는 `error()` 안에서 MDC 의 traceId 를 쓰게 바꾼다. 이 PR 은 `handleApiException` 이 `error()` 를 거치지 않아, 합칠 때 `error()` 쪽만 맞추면 ApiException 으로 나가는 에러(404·409 등 대부분)가 요청 로그와 다른 traceId 를 갖는다.
- #225 의 traceId 테스트는 500(`error()` 경로)만 봐서 잘못 합쳐도 초록이다. 그래서 #225 에는 ApiException 경로 테스트를 따로 더했다(#225 worklog).
- 만드는 곳을 하나로 모으면 #225 와 합칠 때 MDC 를 넣을 자리가 `error(..., runId)` 하나뿐이라 빠뜨릴 수 없다.

## 확인한 것

- `gradlew -p backend check` 통과(unit 410, integration 278).

## 남은 것 · 아는 문제

- #225 와 합친 상태는 아직 돌려 보지 않았다. 뒤에 머지하는 쪽에서 MDC 를 `error(..., runId)` 에 넣고 #225 의 새 테스트로 확인한다.
