package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.transaction.domain.UploadResult;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * 업로드 Idempotency-Key 한 건 (V12, api.md 1.6). 최초 응답을 컬럼으로 들고 있다가 재전송에 그대로 돌려준다.
 * batch 가 지워지면 DB 가 batchId 를 NULL 로 만든다(ON DELETE SET NULL). 그게 삭제 상태다.
 */
@Entity
@Table(name = "idempotency_key")
class IdempotencyKeyEntity {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "idempotency_key", nullable = false)
    private String key;

    @Column(name = "request_hash", nullable = false)
    private String requestHash;

    @Column(name = "batch_id")
    private UUID batchId;

    @Column(name = "transaction_count", nullable = false)
    private int transactionCount;

    @Column(name = "skipped_duplicate_count", nullable = false)
    private int skippedDuplicateCount;

    @Column(name = "classification_pending_count", nullable = false)
    private int classificationPendingCount;

    @Column(name = "response_created_at", nullable = false)
    private OffsetDateTime responseCreatedAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected IdempotencyKeyEntity() {
    }

    IdempotencyKeyEntity(UUID id, UUID userId, String key) {
        this.id = id;
        this.userId = userId;
        this.key = key;
    }

    /** 최초 응답을 기록한다. 만료된 키를 새 요청으로 다시 쓸 때도 같은 행에 덮어쓴다(UNIQUE(user_id, key)). */
    void record(String requestHash, UploadResult result, OffsetDateTime expiresAt) {
        this.requestHash = requestHash;
        this.batchId = result.id();
        this.transactionCount = result.transactionCount();
        this.skippedDuplicateCount = result.skippedDuplicateCount();
        this.classificationPendingCount = result.classificationPendingCount();
        this.responseCreatedAt = result.createdAt();
        this.expiresAt = expiresAt;
    }

    boolean expiredAt(OffsetDateTime now) {
        return !expiresAt.isAfter(now);
    }

    boolean sameRequest(String requestHash) {
        return this.requestHash.equals(requestHash);
    }

    boolean batchDeleted() {
        return batchId == null;
    }

    /** DB 에서 읽은 timestamptz 는 UTC 로 오므로 최초 응답과 같은 KST 표기로 되돌린다. */
    UploadResult replay() {
        return new UploadResult(batchId, transactionCount, skippedDuplicateCount, classificationPendingCount,
            responseCreatedAt.atZoneSameInstant(KST).toOffsetDateTime());
    }
}
