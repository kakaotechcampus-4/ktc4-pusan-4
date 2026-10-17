package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRunFailure;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
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

    static final String FAILURE_CODE = "RULE_PROCESSING_FAILED";
    // 응답으로 나가므로 예외 메시지 대신 고정 문구를 쓴다. 원인은 JudgmentRunner 가 로그에 남긴다.
    static final String FAILURE_MESSAGE = "판정 처리 중 오류가 발생했습니다.";

    @EmbeddedId
    private Key key;

    @Column(nullable = false)
    private String status;

    @Column(name = "error_code")
    private String errorCode;

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
        this.errorCode = FAILURE_CODE;
        this.errorMessage = FAILURE_MESSAGE;
        this.processedAt = now;
    }

    JudgmentRunFailure toFailure() {
        return new JudgmentRunFailure(key.transactionId, errorCode, errorMessage, processedAt);
    }

    @Embeddable
    record Key(
        @Column(name = "run_id") UUID runId,
        @Column(name = "transaction_id") UUID transactionId
    ) implements Serializable {
    }
}
