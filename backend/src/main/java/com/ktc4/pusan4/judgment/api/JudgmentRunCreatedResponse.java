package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record JudgmentRunCreatedResponse(
    UUID id,
    UUID batchId,
    UUID contextId,
    int contextVersion,
    Coded<JudgmentRunStatus> status,
    @Schema(description = "effectiveStatus = JUDGEABLE 이고 classificationStatus = CLASSIFIED 인 거래 수") int totalCount
) {
    static JudgmentRunCreatedResponse from(JudgmentRun run) {
        return new JudgmentRunCreatedResponse(run.id(), run.batchId(), run.contextId(), run.contextVersion(),
            JudgmentRunResponse.status(run.status()), run.totalCount());
    }
}
