package com.ktc4.pusan4.transaction.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 미분류 거래의 분류 확인 요청 (V7, api.md 2.6·3.5). 업로드와 포함(include)은 PENDING 으로만 만든다.
 * 응답(RESOLVED) 처리는 B8 이 이 엔티티에 메서드를 더한다.
 */
@Entity
@Table(name = "classification_review")
class ClassificationReviewEntity {

    @Id
    private UUID id;

    @Column(name = "transaction_id", nullable = false)
    private UUID transactionId;

    @Column(nullable = false)
    private String status;

    @Column(name = "selected_category")
    private String selectedCategory;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    protected ClassificationReviewEntity() {
    }

    static ClassificationReviewEntity pending(UUID id, UUID transactionId, OffsetDateTime createdAt) {
        ClassificationReviewEntity review = new ClassificationReviewEntity();
        review.id = id;
        review.transactionId = transactionId;
        review.status = "PENDING";
        review.createdAt = createdAt;
        return review;
    }
}
