package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
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
    static JudgmentRunResponse from(JudgmentRun run) {
        return new JudgmentRunResponse(run.id(), run.batchId(), run.contextId(), run.contextVersion(),
            status(run.status()), run.totalCount(), run.processedCount(), run.failedCount(),
            run.startedAt(), run.completedAt());
    }

    /** 화면 문구는 api.md 2.7 을 따른다. */
    static Coded<JudgmentRunStatus> status(JudgmentRunStatus status) {
        String label = switch (status) {
            case QUEUED -> "대기";
            case RUNNING -> "실행 중";
            case COMPLETED -> "완료";
            case PARTIAL_FAILED -> "부분 실패";
            case FAILED -> "전체 실패";
        };
        return new Coded<>(status, label);
    }
}
