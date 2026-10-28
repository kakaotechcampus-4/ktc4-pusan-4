package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.transaction.api.CardIssuer;
import com.ktc4.pusan4.transaction.api.SourceType;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import com.ktc4.pusan4.transaction.domain.UploadBatchSummary;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * 업로드 한 번 (V1, api.md 3.3). sourceType·cardIssuer 는 api.md 2.10·2.11 의 한글 값을 그대로 담는다.
 *
 * <p>업로드 서비스({@code transaction.persistence})가 만들기 때문에 public 이다. 상태를 바꾸는 메서드는 없다.
 * 거래 수·분류 대기 수는 저장하지 않고 조회할 때 센다. 건너뛴 중복 수만 남긴다(V13).
 */
@Entity
@Table(name = "upload_batch")
public class UploadBatchEntity {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

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

    @Column(name = "skipped_duplicate_count", nullable = false)
    private int skippedDuplicateCount;

    // 응답에 바로 쓰려고 코드가 채운다(DB 기본값 now() 는 SQL 로 넣는 테스트 픽스처용으로 남는다).
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected UploadBatchEntity() {
    }

    public UploadBatchEntity(
        UUID id, UUID userId, NewUploadBatch input, int skippedDuplicateCount, OffsetDateTime createdAt
    ) {
        this.id = id;
        this.userId = userId;
        this.sourceType = input.sourceType().name();
        this.cardIssuer = input.cardIssuer().name();
        this.periodStart = input.periodStart();
        this.periodEnd = input.periodEnd();
        this.fileHash = input.fileHash();
        this.skippedDuplicateCount = skippedDuplicateCount;
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

    /** DB 에서 읽은 timestamptz 는 UTC 로 오므로 업로드 응답(201)과 같은 KST 표기로 되돌린다. */
    public UploadBatchSummary toSummary(int transactionCount, int classificationPendingCount) {
        return new UploadBatchSummary(id, SourceType.valueOf(sourceType), CardIssuer.valueOf(cardIssuer),
            periodStart, periodEnd, transactionCount, skippedDuplicateCount, classificationPendingCount,
            createdAt.atZoneSameInstant(KST).toOffsetDateTime());
    }
}
