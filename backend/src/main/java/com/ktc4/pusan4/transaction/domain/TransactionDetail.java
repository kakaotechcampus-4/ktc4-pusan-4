package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.UserInclusion;

import java.time.LocalDate;
import java.util.UUID;

/**
 * 거래 한 건 (api.md 3.4). effectiveStatus 는 저장하지 않고 sourceStatus·userInclusion 으로 계산한다(api.md 2.3).
 */
public record TransactionDetail(
    UUID id,
    UUID batchId,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    String merchantCategory,
    ClassificationStatus classificationStatus,
    long amount,
    int installmentMonths,
    SourceStatus sourceStatus,
    UserInclusion userInclusion
) {

    public SourceStatus effectiveStatus() {
        return effectiveStatus(sourceStatus, userInclusion);
    }

    /** 취소상계는 늘 취소상계다. 그 밖에는 사용자의 포함·제외가 파서 결과를 이긴다. */
    public static SourceStatus effectiveStatus(SourceStatus sourceStatus, UserInclusion userInclusion) {
        if (sourceStatus == SourceStatus.CANCELED_OFFSET) {
            return SourceStatus.CANCELED_OFFSET;
        }
        return switch (userInclusion) {
            case AUTO -> sourceStatus;
            case INCLUDED -> SourceStatus.JUDGEABLE;
            case EXCLUDED -> SourceStatus.EXCLUDED;
        };
    }
}
