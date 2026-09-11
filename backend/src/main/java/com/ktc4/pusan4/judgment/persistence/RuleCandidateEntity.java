package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

@Entity
@Table(name = "rule_candidate")
class RuleCandidateEntity {

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
    private List<String> suggestedDocs;

    @Column(name = "searched_tier")
    private String searchedTier;

    @Column(name = "draft_yaml")
    private String draftYaml;

    @Column(nullable = false)
    private String status;

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
        this.status = "대기";
    }

    Long id() {
        return id;
    }
}
