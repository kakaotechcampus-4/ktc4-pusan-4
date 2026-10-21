package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.transaction.domain.UploadBatchSummary;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record UploadBatchResponse(
    UUID id,
    SourceType sourceType,
    CardIssuer cardIssuer,
    LocalDate periodStart,
    LocalDate periodEnd,
    int transactionCount,
    int skippedDuplicateCount,
    int classificationPendingCount,
    OffsetDateTime createdAt
) {

    static UploadBatchResponse from(UploadBatchSummary batch) {
        return new UploadBatchResponse(batch.id(), batch.sourceType(), batch.cardIssuer(), batch.periodStart(),
            batch.periodEnd(), batch.transactionCount(), batch.skippedDuplicateCount(),
            batch.classificationPendingCount(), batch.createdAt());
    }
}
