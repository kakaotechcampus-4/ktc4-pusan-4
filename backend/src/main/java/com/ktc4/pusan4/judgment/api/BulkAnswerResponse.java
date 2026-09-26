package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record BulkAnswerResponse(
    @Schema(description = "ANSWERED 로 전환된 질문 수") int answeredCount,
    @Schema(description = "요청 당시 해당 Batch 의 PENDING 중 factType 이 달라 건너뛴 수") int skippedCount,
    @Schema(description = "생성된 UserFact ID. scopeKey 가 다르면 여러 개") List<UUID> factIds,
    @Schema(description = "중복을 제거한 재판정 거래 수") int rejudgedTransactionCount,
    @Schema(description = "처리 후 해당 Batch 에 남은 미해소 집계") Unresolved unresolved
) {
}
