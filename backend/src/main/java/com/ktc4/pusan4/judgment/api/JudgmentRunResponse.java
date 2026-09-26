package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

public record JudgmentRunResponse(
    UUID id,
    UUID batchId,
    UUID contextId,
    int contextVersion,
    Coded<JudgmentRunStatus> status,
    int totalCount,
    @Schema(description = "처리가 끝난 거래 수. NEEDS_REVIEW 도 처리된 것으로 센다") int processedCount,
    int failedCount,
    OffsetDateTime startedAt,
    OffsetDateTime completedAt
) {
}
