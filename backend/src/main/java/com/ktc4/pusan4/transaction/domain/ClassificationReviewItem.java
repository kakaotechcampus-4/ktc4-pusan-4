package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.merchant.api.ClassificationReviewStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 분류 확인 요청 한 건과 그 거래 요약 (api.md 3.5). 거래 값은 판정 당시가 아니라 조회 시점 값이다.
 *
 * @param suggestedCategories 분류 모델이 고른 후보(최대 3개). 모델 답이 없으면 빈 목록
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
    int installmentMonths,
    List<String> suggestedCategories
) {
}
