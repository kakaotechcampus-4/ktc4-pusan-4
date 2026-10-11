package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 카드 거래 한 건 (V8, api.md 3.3·3.4).
 *
 * <p>상태 컬럼 3개는 api.md 의 enum 이름(code)을 문자열로 담는다. 허용값은 DB CHECK 가 지킨다.
 * effectiveStatus 는 저장하지 않고 sourceStatus·userInclusion 으로 계산한다(api.md 2.3).
 */
@Entity
@Table(name = "transaction")
class TransactionRecordEntity {

    @Id
    private UUID id;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "approved_at", nullable = false)
    private LocalDate approvedAt;

    @Column(name = "merchant_raw", nullable = false)
    private String merchantRaw;

    @Column(name = "merchant_norm", nullable = false)
    private String merchantNorm;

    @Column(name = "merchant_category", nullable = false)
    private String merchantCategory;

    @Column(nullable = false)
    private long amount;

    @Column(name = "installment_months", nullable = false)
    private int installmentMonths;

    @Column(name = "natural_key", nullable = false)
    private String naturalKey;

    /** 파서가 정한 원본 상태. JUDGEABLE / CANCELED_OFFSET / EXCLUDED. */
    @Column(name = "source_status", nullable = false)
    private String sourceStatus;

    /** 사용자의 포함·제외. AUTO / INCLUDED / EXCLUDED. */
    @Column(name = "user_inclusion", nullable = false)
    private String userInclusion;

    /** 가맹점 분류 상태. CLASSIFIED / NEEDS_REVIEW. 미분류이면 NEEDS_REVIEW 다. */
    @Column(name = "classification_status", nullable = false)
    private String classificationStatus;

    @Column(name = "approval_no")
    private String approvalNo;

    @Column(name = "biz_no")
    private String bizNo;

    private String branch;

    @Column(name = "branch_raw")
    private String branchRaw;

    private String memo;

    @Column(name = "is_aggregated", nullable = false)
    private boolean aggregated;

    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    @Column(name = "review_reason")
    private String reviewReason;

    @Column(name = "source_card")
    private String sourceCard;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected TransactionRecordEntity() {
    }
}
