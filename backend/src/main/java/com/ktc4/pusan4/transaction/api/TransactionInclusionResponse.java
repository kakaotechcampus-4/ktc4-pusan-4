package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.Coded;

import java.util.UUID;

public record TransactionInclusionResponse(
    UUID id,
    UserInclusion userInclusion,
    Coded<SourceStatus> effectiveStatus
) {
}
