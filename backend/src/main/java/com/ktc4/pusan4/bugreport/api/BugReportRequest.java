package com.ktc4.pusan4.bugreport.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 화면 주소, 브라우저, traceId 는 화면이 채운다. traceId 는 마지막으로 받은 에러 응답의 값이다. */
public record BugReportRequest(
    @Schema(example = "결과 화면에서 금액이 0원으로 나와요") @NotBlank @Size(max = 2000) String message,
    @Size(max = 2000) String pageUrl,
    @Size(max = 500) String userAgent,
    @Size(max = 100) String traceId
) {
}
