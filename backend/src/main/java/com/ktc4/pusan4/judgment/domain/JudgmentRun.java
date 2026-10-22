package com.ktc4.pusan4.judgment.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Batch 한 번의 판정 실행 (api.md 3.6). */
public record JudgmentRun(
    UUID id,
    UUID batchId,
    UUID contextId,
    int contextVersion,
    JudgmentRunStatus status,
    int totalCount,
    int processedCount,
    int failedCount,
    OffsetDateTime startedAt,
    OffsetDateTime completedAt
) {
}
