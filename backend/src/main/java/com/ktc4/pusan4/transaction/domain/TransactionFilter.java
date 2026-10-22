package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;

import java.util.UUID;

/**
 * GET /transactions 의 조건 (api.md 3.4). 주어진 조건은 모두 AND 로 건다. null 이면 걸지 않는다.
 *
 * @param month   승인일의 월(1~12). year 없이 주면 모든 해의 그 달이다(프론트 목과 같다)
 * @param status  effectiveStatus 기준
 * @param verdict 현재 결과(api.md §5) 기준. 판정 대상이 아닌 거래(제외·미분류)와 판정이 없는 거래는 빠진다
 */
public record TransactionFilter(
    UUID batchId,
    Integer year,
    Integer month,
    SourceStatus status,
    ClassificationStatus classificationStatus,
    Verdict verdict
) {
}
