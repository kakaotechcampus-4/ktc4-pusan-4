package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.transaction.api.SourceStatus;

import java.time.LocalDate;

/**
 * 프론트 파서가 만든 거래 한 건(api.md 3.3 transactions[]). 선택 필드의 기본값은 여기서 채운다.
 */
public record NewTransaction(
    LocalDate approvedAt,
    String merchantRaw,
    long amount,
    String naturalKey,
    SourceStatus status,
    int installmentMonths,
    String approvalNo,
    String bizNo,
    String branch,
    String branchRaw,
    String memo,
    boolean aggregated,
    boolean needsReview,
    String reviewReason,
    String sourceCard
) {
}
