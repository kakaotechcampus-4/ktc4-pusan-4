package com.ktc4.pusan4.shared.api;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * api.md 에 정의된 에러 코드를 던질 때 쓴다. {@link ApiExceptionHandler} 가 {@link ErrorResponse} 로 바꾼다.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final HttpHeaders headers;
    private final String runId;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, HttpHeaders.EMPTY);
    }

    /** 응답에 함께 실을 헤더가 있을 때(예: 429 의 Retry-After). */
    public ApiException(HttpStatus status, String code, String message, HttpHeaders headers) {
        this(status, code, message, headers, null);
    }

    /** 충돌한 판정 실행을 응답 본문의 runId 로 알려 줄 때(api.md 1.3, 409 RUN_ALREADY_ACTIVE). */
    public ApiException(HttpStatus status, String code, String message, String runId) {
        this(status, code, message, HttpHeaders.EMPTY, runId);
    }

    private ApiException(HttpStatus status, String code, String message, HttpHeaders headers, String runId) {
        super(message);
        this.status = status;
        this.code = code;
        this.headers = headers;
        this.runId = runId;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public HttpHeaders getHeaders() {
        return headers;
    }

    /** 없으면 null. */
    public String getRunId() {
        return runId;
    }
}
