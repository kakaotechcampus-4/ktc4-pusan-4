package com.ktc4.pusan4.shared.api;

import com.ktc4.pusan4.shared.UuidGenerator;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private final UuidGenerator uuidGenerator;

    public ApiExceptionHandler(UuidGenerator uuidGenerator) {
        this.uuidGenerator = uuidGenerator;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> handleApiException(ApiException exception) {
        return ResponseEntity.status(exception.getStatus())
            .body(error(exception.getCode(), exception.getMessage()));
    }

    /**
     * 일반 요청 오류(필수 값 누락, 타입 불일치, 헤더 누락, 본문 파싱 실패).
     * api.md 에 이 경우의 코드가 없어 임시로 VALIDATION_ERROR 를 쓴다 (api.md 확정 후 반영).
     */
    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        HandlerMethodValidationException.class,
        MethodArgumentTypeMismatchException.class,
        ServletRequestBindingException.class,
        HttpMessageNotReadableException.class
    })
    ResponseEntity<ErrorResponse> handleInvalidRequest(Exception exception) {
        return ResponseEntity.badRequest()
            .body(error("VALIDATION_ERROR", "요청 값이 올바르지 않습니다."));
    }

    private ErrorResponse error(String code, String message) {
        return new ErrorResponse(code, message, uuidGenerator.generate().toString());
    }
}
