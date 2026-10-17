package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Verdict;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 사용자 판정 수정 (V7, api.md 3.8). 해제해도 지우지 않고 active 만 끈다.
 */
@Entity
@Table(name = "judgment_override")
class JudgmentOverrideEntity {

    @Id
    private UUID id;

    @Column(name = "transaction_id", nullable = false)
    private UUID transactionId;

    @Column(name = "source_judgment_id", nullable = false)
    private UUID sourceJudgmentId;

    @Column(name = "to_verdict", nullable = false)
    private String toVerdict;

    private String reason;

    /** 거래당 활성 override 는 하나다(uq_judgment_override_active_transaction). */
    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "released_at")
    private OffsetDateTime releasedAt;

    protected JudgmentOverrideEntity() {
    }

    JudgmentOverrideEntity(
        UUID id, UUID transactionId, UUID sourceJudgmentId, Verdict toVerdict, String reason, OffsetDateTime createdAt
    ) {
        this.id = id;
        this.transactionId = transactionId;
        this.sourceJudgmentId = sourceJudgmentId;
        this.toVerdict = toVerdict.name();
        this.reason = reason;
        this.active = true;
        this.createdAt = createdAt;
    }

    /** 이미 해제했으면 처음 해제한 시각을 그대로 둔다. */
    void release(OffsetDateTime now) {
        if (!active) {
            return;
        }
        active = false;
        releasedAt = now;
    }
}
