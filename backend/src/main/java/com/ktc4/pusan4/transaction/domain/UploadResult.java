package com.ktc4.pusan4.transaction.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 업로드 결과 (api.md 3.3 응답 201).
 *
 * @param transactionCount           저장한 거래 수. 건너뛴 중복은 빠진다
 * @param skippedDuplicateCount      naturalKey 가 이미 있어(같은 요청 안의 반복 포함) 건너뛴 수
 * @param classificationPendingCount 미분류로 저장해 ClassificationReview 를 만든 수
 */
public record UploadResult(
    UUID id,
    int transactionCount,
    int skippedDuplicateCount,
    int classificationPendingCount,
    OffsetDateTime createdAt
) {
}
