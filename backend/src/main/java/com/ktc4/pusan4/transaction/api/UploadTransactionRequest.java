package com.ktc4.pusan4.transaction.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/**
 * 프론트 파서가 만든 거래 한 건 (api.md 3.3 transactions[]).
 *
 * <p>naturalKey 누락은 400 이 아니라 422 MISSING_NATURAL_KEY 로 응답해야 해서 Bean Validation 을 걸지 않는다.
 */
public record UploadTransactionRequest(
    @Schema(requiredMode = REQUIRED, description = "승인일") LocalDate approvedAt,
    @Schema(requiredMode = REQUIRED, description = "파서가 전달한 원본 표시값") String merchantRaw,
    @Schema(requiredMode = REQUIRED) Long amount,
    @Schema(requiredMode = REQUIRED, description = "프론트 파서가 계산") String naturalKey,
    @Schema(requiredMode = REQUIRED, description = "파서의 sourceStatus") SourceStatus status,
    @Schema(description = "기본 0") Integer installmentMonths,
    @Schema(description = "naturalKey 재료") String approvalNo,
    String bizNo,
    String branch,
    String branchRaw,
    String memo,
    Boolean isAggregated,
    @Schema(description = "파서 단계 확인 필요 여부") Boolean needsReview,
    String reviewReason,
    String sourceCard
) {
}
