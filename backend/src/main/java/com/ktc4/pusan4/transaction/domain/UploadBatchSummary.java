package com.ktc4.pusan4.transaction.domain;

import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.SourceType;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 업로드 배치 목록·상세 한 건 (api.md 3.3).
 *
 * @param transactionCount           지금 이 batch 에 있는 거래 수. 업로드 응답의 transactionCount 와 같다
 * @param skippedDuplicateCount      업로드할 때 naturalKey 중복으로 건너뛴 수
 * @param classificationPendingCount 지금 PENDING 인 분류 검토 수. 사용자가 답하면 줄어든다
 */
public record UploadBatchSummary(
    UUID id,
    SourceType sourceType,
    CardIssuer cardIssuer,
    LocalDate periodStart,
    LocalDate periodEnd,
    int transactionCount,
    int skippedDuplicateCount,
    int classificationPendingCount,
    OffsetDateTime createdAt
) {
}
