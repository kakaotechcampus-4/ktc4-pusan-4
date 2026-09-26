package com.ktc4.pusan4.merchant.api;

import io.swagger.v3.oas.annotations.media.Schema;

public record ClassificationAnswerResponse(
    int resolvedCount,
    String merchantCategory,
    @Schema(description = "Batch 에 완료된 JudgmentRun 이 없으면 0") int judgedCount
) {
}
