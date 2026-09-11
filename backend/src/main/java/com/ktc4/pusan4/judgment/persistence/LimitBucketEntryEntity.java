package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.limit.LimitAllocation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "limit_bucket_entry")
class LimitBucketEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "tax_year", nullable = false)
    private int taxYear;

    @Column(name = "bucket_code", nullable = false)
    private String bucketCode;

    @Column(name = "judgment_id", nullable = false)
    private UUID judgmentId;

    @Column(name = "tagged_amount", nullable = false)
    private long taggedAmount;

    @Column(name = "allowed_amount", nullable = false)
    private long allowedAmount;

    @Column(nullable = false)
    private String state;

    protected LimitBucketEntryEntity() {
    }

    LimitBucketEntryEntity(
        UUID userId,
        int taxYear,
        String bucketCode,
        LimitAllocation allocation
    ) {
        this.userId = userId;
        this.taxYear = taxYear;
        this.bucketCode = bucketCode;
        this.judgmentId = allocation.judgmentId();
        updateProvisional(allocation);
    }

    UUID judgmentId() {
        return judgmentId;
    }

    void updateProvisional(LimitAllocation allocation) {
        this.taggedAmount = allocation.taggedAmount();
        this.allowedAmount = allocation.allowedAmount();
        this.state = "잠정";
    }

    void finalizeEntry() {
        this.state = "확정";
    }
}
