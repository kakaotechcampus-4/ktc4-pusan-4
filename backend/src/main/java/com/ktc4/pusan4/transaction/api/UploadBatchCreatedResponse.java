package com.ktc4.pusan4.transaction.api;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UploadBatchCreatedResponse(
    UUID id,
    int transactionCount,
    int skippedDuplicateCount,
    int classificationPendingCount,
    OffsetDateTime createdAt
) {
}
