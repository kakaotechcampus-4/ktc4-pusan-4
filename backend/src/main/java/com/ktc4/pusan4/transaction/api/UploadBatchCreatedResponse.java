package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.transaction.domain.UploadResult;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UploadBatchCreatedResponse(
    UUID id,
    int transactionCount,
    int skippedDuplicateCount,
    int classificationPendingCount,
    OffsetDateTime createdAt
) {

    public static UploadBatchCreatedResponse from(UploadResult result) {
        return new UploadBatchCreatedResponse(result.id(), result.transactionCount(), result.skippedDuplicateCount(),
            result.classificationPendingCount(), result.createdAt());
    }
}
