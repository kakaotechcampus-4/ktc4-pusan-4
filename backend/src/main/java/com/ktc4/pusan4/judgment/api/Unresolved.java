package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "미해소 집계 (api.md 3.9). batchId·transactionId 필터만 적용하고 status·grouped·page·size 는 적용하지 않는다")
public record Unresolved(
    @Schema(description = "페이지네이션 전 PENDING Question 수") int count,
    @Schema(description = "PENDING Question 이 참조하는 거래 금액 합계(원). 같은 거래는 한 번만 합산한다") long amount
) {
}
