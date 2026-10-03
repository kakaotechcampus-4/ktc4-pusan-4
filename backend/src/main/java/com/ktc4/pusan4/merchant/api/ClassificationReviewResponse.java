package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=false 일 때의 항목")
public record ClassificationReviewResponse(
    UUID id,
    UUID batchId,
    UUID transactionId,
    String merchantRaw,
    String merchantNorm,
    Coded<ClassificationReviewStatus> status,
    List<String> suggestedCategories,
    OffsetDateTime createdAt,
    OffsetDateTime resolvedAt
) {
}
