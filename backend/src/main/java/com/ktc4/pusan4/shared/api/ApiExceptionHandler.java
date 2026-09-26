package com.ktc4.pusan4.shared.api;

import com.ktc4.pusan4.shared.UuidGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /**
     * 전용 코드가 없는 실패의 상태 코드별 공통 코드 (api.md 1.3).
     */
    private static final Map<Integer, String> COMMON_CODES = Map.of(
        400, "VALIDATION_ERROR",
        401, "UNAUTHORIZED",
        404, "NOT_FOUND",
        409, "CONFLICT",
        422, "UNPROCESSABLE_ENTITY",
        500, "INTERNAL_ERROR"
    );

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
     * 일반 요청 오류(필수 값 누락, 타입 불일치, 헤더 누락, 본문 파싱 실패). api.md 1.3 의 VALIDATION_ERROR.
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

    /**
     * 그 밖의 모든 예외. Spring 이 상태 코드를 정해 둔 예외(없는 경로 404, 허용되지 않은 메서드 405 등)는
     * 그 상태를 유지하고, 나머지는 500 INTERNAL_ERROR 로 응답한다.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception exception) {
        if (exception instanceof org.springframework.web.ErrorResponse springError) {
            HttpStatusCode status = springError.getStatusCode();
            String detail = springError.getBody().getDetail();
            return ResponseEntity.status(status)
                .body(error(commonCode(status), detail == null ? "요청을 처리할 수 없습니다." : detail));
        }
        log.error("처리되지 않은 예외", exception);
        return ResponseEntity.internalServerError()
            .body(error("INTERNAL_ERROR", "서버 오류가 발생했습니다."));
    }

    /**
     * api.md 1.3 표에 없는 상태(405, 415 등)는 HTTP 상태 이름을 code 로 쓴다.
     */
    private static String commonCode(HttpStatusCode status) {
        String code = COMMON_CODES.get(status.value());
        if (code != null) {
            return code;
        }
        HttpStatus resolved = HttpStatus.resolve(status.value());
        return resolved == null ? "HTTP_" + status.value() : resolved.name();
    }

    private ErrorResponse error(String code, String message) {
        return new ErrorResponse(code, message, uuidGenerator.generate().toString());
    }
}
