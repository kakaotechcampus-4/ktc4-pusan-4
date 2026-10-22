package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision.CitedStatute;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;
import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.domain.UnmatchedReason;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.judgment.domain.Verdict;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
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

    @Column(name = "is_out_of_scope", nullable = false)
    private boolean outOfScope;

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

    // 금액 계산(A6) 전이라 저장하지 않는다. 비어 있다.
    @Column(name = "final_amount", insertable = false, updatable = false)
    private Long finalAmount;

    @Column(name = "computed_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime computedAt;

    // origin 은 FK 4개 중 정확히 하나만 채운다 (api.md §4, judgment_has_one_origin).
    @Column(name = "run_id")
    private UUID runId;

    @Column(name = "trigger_user_fact_id")
    private UUID triggerUserFactId;

    @Column(name = "classification_review_id")
    private UUID classificationReviewId;

    @Column(name = "judgment_override_id")
    private UUID judgmentOverrideId;

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
        this.outOfScope = judgment.outOfScope();
        this.account = judgment.account();
        this.attributes = judgment.attributes();
        this.appliedRuleIds = judgment.appliedRuleIds();
        this.inputFacts = command.inputFacts();
        JudgmentOrigin origin = command.origin();
        switch (origin.type()) {
            case RUN -> this.runId = origin.id();
            case USER_FACT -> this.triggerUserFactId = origin.id();
            case CLASSIFICATION_REVIEW -> this.classificationReviewId = origin.id();
            case OVERRIDE -> this.judgmentOverrideId = origin.id();
        }
    }

    /**
     * 사용자 수정 revision (api.md 3.8). verdict 만 바꾸고 나머지는 이 판정에서 이어받는다.
     * 대상 밖 표시는 확인 필요에만 붙으므로(judgment_out_of_scope_needs_review) 끈다. 수정은 확인 필요로 가지 않는다.
     */
    JudgmentEntity overriddenAs(UUID revisionId, int nextRevision, Verdict toVerdict, UUID overrideId) {
        JudgmentEntity revision = new JudgmentEntity();
        revision.id = revisionId;
        revision.transactionId = transactionId;
        revision.revision = nextRevision;
        revision.ruleCardId = ruleCardId;
        revision.ruleCardVersion = ruleCardVersion;
        revision.rulesCommitSha = rulesCommitSha;
        revision.userContextVersion = userContextVersion;
        revision.taxYear = taxYear;
        revision.verdict = toVerdict.name();
        revision.blockedAtGate = blockedAtGate;
        revision.inference = inference;
        revision.unmatchedReason = unmatchedReason;
        revision.outOfScope = false;
        revision.account = account;
        revision.attributes = attributes;
        revision.appliedRuleIds = appliedRuleIds;
        revision.inputFacts = inputFacts;
        revision.judgmentOverrideId = overrideId;
        return revision;
    }

    UUID id() {
        return id;
    }

    UUID transactionId() {
        return transactionId;
    }

    JudgmentRevision toDomain(JudgedTransaction transaction, List<CitedStatute> citations) {
        return new JudgmentRevision(id, transactionId, transaction, revision, origin(),
            Verdict.valueOf(verdict),
            blockedAtGate == null ? null : Gate.valueOf(blockedAtGate),
            outOfScope, account, finalAmount, inference,
            unmatchedReason == null ? null : UnmatchedReason.valueOf(unmatchedReason),
            attributes, ruleCardId, ruleCardVersion, appliedRuleIds, rulesCommitSha, userContextVersion,
            computedAt, citations);
    }

    JudgmentSummary.Row toSummaryRow() {
        return new JudgmentSummary.Row(Verdict.valueOf(verdict), account, finalAmount);
    }

    private JudgmentOrigin origin() {
        if (runId != null) {
            return new JudgmentOrigin(JudgmentOriginType.RUN, runId);
        }
        if (triggerUserFactId != null) {
            return new JudgmentOrigin(JudgmentOriginType.USER_FACT, triggerUserFactId);
        }
        if (classificationReviewId != null) {
            return new JudgmentOrigin(JudgmentOriginType.CLASSIFICATION_REVIEW, classificationReviewId);
        }
        return new JudgmentOrigin(JudgmentOriginType.OVERRIDE, judgmentOverrideId);
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
