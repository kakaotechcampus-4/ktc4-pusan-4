package com.ktc4.pusan4.shared.api;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "에러 응답 (api.md 1.3)")
public record ErrorResponse(
    @Schema(example = "TRANSACTION_NOT_FOUND") String code,
    @Schema(example = "요청한 거래를 찾을 수 없습니다.") String message,
    @Schema(example = "0199c8f2-1a2b-7c3d-8e4f-5a6b7c8d9e0f") String traceId
) {
}
