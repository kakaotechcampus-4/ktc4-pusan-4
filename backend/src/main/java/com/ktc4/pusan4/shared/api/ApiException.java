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

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, HttpHeaders.EMPTY);
    }

    /** 응답에 함께 실을 헤더가 있을 때(예: 429 의 Retry-After). */
    public ApiException(HttpStatus status, String code, String message, HttpHeaders headers) {
        super(message);
        this.status = status;
        this.code = code;
        this.headers = headers;
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
}
