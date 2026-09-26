package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

public record JudgmentRunFailureResponse(
    UUID transactionId,
    @Schema(example = "RULE_PROCESSING_FAILED") String errorCode,
    String message,
    OffsetDateTime failedAt
) {
}
