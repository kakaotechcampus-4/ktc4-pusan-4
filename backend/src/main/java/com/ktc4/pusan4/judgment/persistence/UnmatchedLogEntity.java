package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "unmatched_log")
class UnmatchedLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "judgment_id", nullable = false)
    private UUID judgmentId;

    @Column(nullable = false)
    private String reason;

    @Column(name = "merchant_category", nullable = false)
    private String merchantCategory;

    @Column(name = "merchant_raw", nullable = false)
    private String merchantRaw;

    @Column(name = "industry_code", nullable = false)
    private String industryCode;

    protected UnmatchedLogEntity() {
    }

    UnmatchedLogEntity(UUID judgmentId, SaveJudgmentCommand command) {
        this.judgmentId = judgmentId;
        this.reason = command.judgment().unmatchedReason().name();
        this.merchantCategory = command.merchantCategory();
        this.merchantRaw = command.merchantRaw();
        this.industryCode = command.industryCode();
    }
}
