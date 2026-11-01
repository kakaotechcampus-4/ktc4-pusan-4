package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;

import java.util.UUID;

public record TransactionInclusionResponse(
    UUID id,
    UserInclusion userInclusion,
    Coded<SourceStatus> effectiveStatus
) {

    static TransactionInclusionResponse from(TransactionDetail transaction) {
        return new TransactionInclusionResponse(transaction.id(), transaction.userInclusion(),
            TransactionResponse.sourceStatus(transaction.effectiveStatus()));
    }
}
