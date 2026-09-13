package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.UserFact;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "judgment")
class JudgmentEntity {

    @Id
    private UUID id;

    @Column(name = "transaction_id", nullable = false)
    private UUID transactionId;

    @Column(nullable = false)
    private int revision;

    @Column(name = "rule_card_id")
    private String ruleCardId;

    @Column(name = "rule_card_version")
    private Integer ruleCardVersion;

    @Column(name = "rules_commit_sha", nullable = false)
    private String rulesCommitSha;

    @Column(name = "user_context_version", nullable = false)
    private int userContextVersion;

    @Column(name = "tax_year", nullable = false)
    private int taxYear;

    @Column(nullable = false)
    private String verdict;

    @Column(name = "blocked_at_gate")
    private String blockedAtGate;

    @Column(name = "is_inference", nullable = false)
    private boolean inference;

    @Column(name = "unmatched_reason")
    private String unmatchedReason;

    private String account;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> attributes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "applied_rule_ids", nullable = false, columnDefinition = "jsonb")
    private List<String> appliedRuleIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_facts", nullable = false, columnDefinition = "jsonb")
    private List<UserFact> inputFacts;

    protected JudgmentEntity() {
    }

    JudgmentEntity(UUID id, SaveJudgmentCommand command, int revision) {
        Judgment judgment = command.judgment();
        this.id = id;
        this.transactionId = command.transactionId();
        this.revision = revision;
        this.ruleCardId = first(judgment.appliedRuleIds());
        this.ruleCardVersion = firstVersion(judgment.appliedRuleVersions());
        this.rulesCommitSha = command.rulesCommitSha();
        this.userContextVersion = command.userContextVersion();
        this.taxYear = command.taxYear();
        this.verdict = judgment.verdict().name();
        this.blockedAtGate = judgment.blockedAtGate() == null
            ? null
            : judgment.blockedAtGate().name();
        this.inference = judgment.inference();
        this.unmatchedReason = judgment.unmatchedReason() == null
            ? null
            : judgment.unmatchedReason().name();
        this.account = judgment.account();
        this.attributes = judgment.attributes();
        this.appliedRuleIds = judgment.appliedRuleIds();
        this.inputFacts = command.inputFacts();
    }

    private static String first(List<String> values) {
        return values.isEmpty() ? null : values.getFirst();
    }

    private static Integer firstVersion(List<Integer> versions) {
        if (versions.isEmpty() || versions.getFirst() == 0) {
            return null;
        }
        return versions.getFirst();
    }
}
