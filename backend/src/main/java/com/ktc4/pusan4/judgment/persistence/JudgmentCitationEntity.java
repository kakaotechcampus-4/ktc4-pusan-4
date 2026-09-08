package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "judgment_citation")
class JudgmentCitationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "judgment_id", nullable = false)
    private UUID judgmentId;

    @Column(name = "statute_version_id", nullable = false)
    private Long statuteVersionId;

    protected JudgmentCitationEntity() {
    }

    JudgmentCitationEntity(UUID judgmentId, Long statuteVersionId) {
        this.judgmentId = judgmentId;
        this.statuteVersionId = statuteVersionId;
    }
}
