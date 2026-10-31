package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.PendingTotal;

import java.util.List;
import java.util.UUID;

/**
 * 일괄 응답 결과 (api.md 3.11).
 *
 * @param skippedCount  요청 당시 PENDING 중 factType 이 달라 건너뛴 수
 * @param excludedCount 요청 당시 PENDING 중 factType 은 같지만 소명 대기라 건너뛴 수
 * @param unresolved    처리 후 Batch 에 남은 미해소 집계
 */
public record BulkAnswerResult(
    int answeredCount,
    int skippedCount,
    int excludedCount,
    List<UUID> factIds,
    int rejudgedTransactionCount,
    PendingTotal unresolved
) {
}
