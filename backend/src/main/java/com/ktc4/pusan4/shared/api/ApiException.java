package com.ktc4.pusan4.shared.api;

import org.springframework.http.HttpStatus;

/**
 * api.md 에 정의된 에러 코드를 던질 때 쓴다. {@link ApiExceptionHandler} 가 {@link ErrorResponse} 로 바꾼다.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException notImplemented() {
        return new ApiException(HttpStatus.NOT_IMPLEMENTED, "NOT_IMPLEMENTED", "아직 구현되지 않은 API입니다.");
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
