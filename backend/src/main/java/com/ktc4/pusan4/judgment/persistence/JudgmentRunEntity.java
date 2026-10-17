package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRun;
import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "judgment_run")
class JudgmentRunEntity {

    @Id
    private UUID id;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "context_id", nullable = false)
    private UUID contextId;

    @Column(name = "context_version", nullable = false)
    private int contextVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JudgmentRunStatus status;

    @Column(name = "total_count", nullable = false)
    private int totalCount;

    @Column(name = "processed_count", nullable = false)
    private int processedCount;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    protected JudgmentRunEntity() {
    }

    JudgmentRunEntity(UUID id, UUID batchId, UUID contextId, int contextVersion, int totalCount) {
        this.id = id;
        this.batchId = batchId;
        this.contextId = contextId;
        this.contextVersion = contextVersion;
        this.totalCount = totalCount;
        this.status = JudgmentRunStatus.QUEUED;
    }

    UUID batchId() {
        return batchId;
    }

    UUID contextId() {
        return contextId;
    }

    void start(OffsetDateTime now) {
        this.status = JudgmentRunStatus.RUNNING;
        this.startedAt = now;
    }

    void recordSuccess() {
        processedCount++;
    }

    void recordFailure() {
        failedCount++;
    }

    /** 모두 성공하면 COMPLETED, 모두 실패하면 FAILED, 섞이면 PARTIAL_FAILED (api.md 2.7). 대상 0건은 COMPLETED 다. */
    void complete(OffsetDateTime now) {
        if (failedCount == 0) {
            this.status = JudgmentRunStatus.COMPLETED;
        } else if (processedCount == 0) {
            this.status = JudgmentRunStatus.FAILED;
        } else {
            this.status = JudgmentRunStatus.PARTIAL_FAILED;
        }
        this.completedAt = now;
    }

    /** run 자체를 시작하지 못했다(Context 를 읽지 못함 등). 대상 전체를 실패로 센다. */
    void fail(OffsetDateTime now) {
        this.status = JudgmentRunStatus.FAILED;
        this.failedCount = totalCount - processedCount;
        this.completedAt = now;
    }

    JudgmentRun toDomain() {
        return new JudgmentRun(id, batchId, contextId, contextVersion, status,
            totalCount, processedCount, failedCount, startedAt, completedAt);
    }
}
