package com.ktc4.pusan4.transaction.api;

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
}
