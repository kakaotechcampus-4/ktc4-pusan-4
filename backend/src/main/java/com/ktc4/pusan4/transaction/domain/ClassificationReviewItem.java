package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.merchant.api.ClassificationReviewStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 분류 확인 요청 한 건과 그 거래 요약 (api.md 3.5). 거래 값은 판정 당시가 아니라 조회 시점 값이다.
 */
public record ClassificationReviewItem(
    UUID id,
    UUID batchId,
    UUID transactionId,
    ClassificationReviewStatus status,
    OffsetDateTime createdAt,
    OffsetDateTime resolvedAt,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    String merchantCategory,
    long amount,
    int installmentMonths
) {
}
