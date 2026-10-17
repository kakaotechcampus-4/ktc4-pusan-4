package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;
import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionSpec;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.domain.UserFact;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;
import java.time.OffsetDateTime;

@Entity
@Table(name = "question_queue")
class QuestionQueueEntity {

    @Id
    private UUID id;

    @Column(name = "judgment_id", nullable = false)
    private UUID judgmentId;

    @Column(name = "reason_code", nullable = false)
    private String reasonCode;

    @Column(name = "question_text", nullable = false)
    private String questionText;

    @Column(name = "group_key", nullable = false)
    private String groupKey;

    @Column(name = "fact_type", nullable = false)
    private String factType;

    @Column(name = "answered_fact_id")
    private UUID answeredFactId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> options;

    @Column(nullable = false)
    private String status;

    @Column(name = "answered_at")
    private OffsetDateTime answeredAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected QuestionQueueEntity() {
    }

    QuestionQueueEntity(UUID id, UUID judgmentId, QuestionSpec question) {
        this.id = id;
        this.judgmentId = judgmentId;
        this.reasonCode = question.code();
        this.questionText = question.text();
        this.groupKey = question.groupBy();
        this.factType = question.factType();
        this.options = question.options();
        this.status = "PENDING";
    }

    UUID answeredFactId() {
        return answeredFactId;
    }

    String groupKey() {
        return groupKey;
    }

    String factType() {
        return factType;
    }

    boolean isCanceled() {
        return "CANCELED".equals(status);
    }

    /** 선택지가 없는 질문은 어떤 값이든 받는다. */
    boolean accepts(String value) {
        return options.isEmpty() || options.contains(value);
    }

    /**
     * 같은 Batch·groupKey·factType 의 응답을 이 질문에 적는다 (api.md 3.10). PENDING 이면 ANSWERED 로 바꾸고,
     * 이미 답한 질문이면(정정) 새 UserFact 를 가리키게 한다. 이전 답은 UserFact 이전 version 에 남는다.
     */
    void recordAnswer(UUID factId, OffsetDateTime answeredAt) {
        if (isCanceled()) {
            throw new IllegalStateException("Question is canceled: " + id);
        }
        this.answeredFactId = factId;
        this.answeredAt = answeredAt;
        this.status = "ANSWERED";
    }

    boolean isPending() {
        return "PENDING".equals(status);
    }

    Question toDomain(UUID batchId, UUID transactionId, String answer, JudgedTransaction transaction,
        boolean overridden, boolean awaitingExplanation) {
        return new Question(id, batchId, transactionId, groupKey, factType, questionText, options,
            QuestionStatus.valueOf(status), answeredFactId, answer, createdAt, answeredAt, transaction, overridden,
            awaitingExplanation);
    }

    void answer(UUID factId, UserFact fact, OffsetDateTime answeredAt) {
        if (!"PENDING".equals(status)) {
            throw new IllegalStateException("Question is not pending: " + id);
        }
        if (!groupKey.equals(fact.scopeKey())) {
            throw new IllegalArgumentException(
                "Fact scope does not match question group: " + fact.scopeKey()
            );
        }
        if (!factType.equals(fact.factType())) {
            throw new IllegalArgumentException(
                "Fact type does not match question: " + fact.factType()
            );
        }
        if (!options.isEmpty() && !options.contains(fact.selectedValue())) {
            throw new IllegalArgumentException(
                "Fact option is not allowed for question: " + fact.selectedValue()
            );
        }
        this.answeredFactId = factId;
        this.answeredAt = answeredAt;
        this.status = "ANSWERED";
    }
}
