package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 업로드 한 번 (V1, api.md 3.3). sourceType·cardIssuer 는 api.md 2.10·2.11 의 한글 값을 그대로 담는다.
 *
 * <p>업로드 서비스({@code transaction.persistence})가 만들기 때문에 public 이다. 상태를 바꾸는 메서드는 없다.
 */
@Entity
@Table(name = "upload_batch")
public class UploadBatchEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "card_issuer", nullable = false)
    private String cardIssuer;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "file_hash", nullable = false)
    private String fileHash;

    // 응답에 바로 쓰려고 코드가 채운다(DB 기본값 now() 는 SQL 로 넣는 테스트 픽스처용으로 남는다).
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected UploadBatchEntity() {
    }

    public UploadBatchEntity(UUID id, UUID userId, NewUploadBatch input, OffsetDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.sourceType = input.sourceType().name();
        this.cardIssuer = input.cardIssuer().name();
        this.periodStart = input.periodStart();
        this.periodEnd = input.periodEnd();
        this.fileHash = input.fileHash();
        this.createdAt = createdAt;
    }

    public UUID id() {
        return id;
    }

    public UUID userId() {
        return userId;
    }

    public OffsetDateTime createdAt() {
        return createdAt;
    }
}
