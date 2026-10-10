package com.ktc4.pusan4.merchant.api;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "미해소 집계 (api.md 3.5). batchId 필터만 적용하고 status·grouped·page·size 는 적용하지 않는다")
public record ClassificationUnresolved(
    @Schema(description = "페이지네이션 전 PENDING Review 수") int count,
    @Schema(description = "PENDING Review 가 참조하는 거래 금액 합계(원)") long amount
) {
}
