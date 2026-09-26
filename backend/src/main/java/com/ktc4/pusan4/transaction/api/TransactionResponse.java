package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.UUID;

public record TransactionResponse(
    UUID id,
    UUID batchId,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    @Schema(description = MerchantCategories.DESCRIPTION, example = "해외SaaS") String merchantCategory,
    Coded<ClassificationStatus> classificationStatus,
    long amount,
    int installmentMonths,
    Coded<SourceStatus> sourceStatus,
    UserInclusion userInclusion,
    @Schema(description = "sourceStatus 와 userInclusion 으로 계산한 최종 판정 대상 여부 (api.md 2.3)")
    Coded<SourceStatus> effectiveStatus
) {
}
