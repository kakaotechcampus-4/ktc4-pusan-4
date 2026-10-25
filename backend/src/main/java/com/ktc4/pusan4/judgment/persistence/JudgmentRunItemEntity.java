package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRunFailure;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * run 대상 거래 한 건. run 을 만들 때 PENDING 으로 고정하고, 처리하면 SUCCEEDED·FAILED 로 바꾼다.
 * PENDING 은 내부 상태다 (V7).
 */
@Entity
@Table(name = "judgment_run_item")
class JudgmentRunItemEntity {

    @EmbeddedId
    private Key key;

    @Column(nullable = false)
    private String status;

    @Enumerated(EnumType.STRING)
    @Column(name = "error_code")
    private JudgmentRunItemError errorCode;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    protected JudgmentRunItemEntity() {
    }

    JudgmentRunItemEntity(UUID runId, UUID transactionId) {
        this.key = new Key(runId, transactionId);
        this.status = "PENDING";
    }

    void succeed(OffsetDateTime now) {
        this.status = "SUCCEEDED";
        this.processedAt = now;
    }

    void fail(OffsetDateTime now) {
        this.status = "FAILED";
        this.errorCode = JudgmentRunItemError.RULE_PROCESSING_FAILED;
        this.errorMessage = errorCode.message();
        this.processedAt = now;
    }

    JudgmentRunFailure toFailure() {
        return new JudgmentRunFailure(key.transactionId, errorCode.name(), errorMessage, processedAt);
    }

    @Embeddable
    record Key(
        @Column(name = "run_id") UUID runId,
        @Column(name = "transaction_id") UUID transactionId
    ) implements Serializable {
    }
}
