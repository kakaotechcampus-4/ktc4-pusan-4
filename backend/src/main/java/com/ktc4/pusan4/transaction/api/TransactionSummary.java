package com.ktc4.pusan4.transaction.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "거래 요약 (api.md 3.4). 필드 뜻은 GET /transactions 와 같고, 응답 시점의 거래 값이다")
public record TransactionSummary(
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    @Schema(description = MerchantCategories.DESCRIPTION, example = "카페") String merchantCategory,
    long amount,
    int installmentMonths
) {
}
