package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.RuleCandidate;
import com.ktc4.pusan4.judgment.domain.RuleCandidate.SuggestedDoc;
import com.ktc4.pusan4.judgment.domain.RuleCandidateStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * 규칙 후보 (V3). 행은 주로 AI 파이프라인이 SQL 로 넣고, 백엔드는 읽고 승인·기각만 한다.
 * 승인·기각은 동시에 눌러도 한 번만 바뀌어야 해서 엔티티 수정이 아니라 RuleCandidateReviewRepository 의 UPDATE 한 문장으로 한다.
 */
@Entity
@Table(name = "rule_candidate")
class RuleCandidateEntity {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "merchant_category", nullable = false)
    private String merchantCategory;

    @Column(name = "industry_code", nullable = false)
    private String industryCode;

    @Column(name = "distinct_users", nullable = false)
    private int distinctUsers;

    @Column(name = "occurrence_count", nullable = false)
    private int occurrenceCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "suggested_docs", nullable = false, columnDefinition = "jsonb")
    private List<SuggestedDocJson> suggestedDocs;

    @Column(name = "searched_tier")
    private String searchedTier;

    @Column(name = "draft_yaml")
    private String draftYaml;

    @Column(nullable = false)
    private String status;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected RuleCandidateEntity() {
    }

    RuleCandidateEntity(SaveRuleCandidateCommand command) {
        this.merchantCategory = command.merchantCategory();
        this.industryCode = command.industryCode();
        this.distinctUsers = command.distinctUsers();
        this.occurrenceCount = command.occurrenceCount();
        this.suggestedDocs = command.suggestedDocs();
        this.searchedTier = command.searchedTier();
        this.draftYaml = command.draftYaml();
        this.status = RuleCandidateStatus.PENDING.dbValue();
    }

    Long id() {
        return id;
    }

    /** 시각은 DB 에서 UTC 로 오므로 다른 응답과 같은 KST 표기로 바꾼다. */
    RuleCandidate toDomain() {
        List<SuggestedDoc> docs = suggestedDocs.stream()
            .map(doc -> new SuggestedDoc(doc.statuteId(), doc.quote(), doc.tier()))
            .toList();
        return new RuleCandidate(id, merchantCategory, industryCode, distinctUsers, occurrenceCount, docs,
            searchedTier, draftYaml, RuleCandidateStatus.fromDb(status), reviewedBy, kst(reviewedAt), kst(createdAt));
    }

    private static OffsetDateTime kst(OffsetDateTime value) {
        return value == null ? null : value.atZoneSameInstant(KST).toOffsetDateTime();
    }
}
