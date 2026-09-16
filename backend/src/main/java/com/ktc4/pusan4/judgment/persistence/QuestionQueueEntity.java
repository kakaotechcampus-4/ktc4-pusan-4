package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.QuestionSpec;
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
        this.status = "대기";
    }

    void answer(UUID factId, UserFact fact, OffsetDateTime answeredAt) {
        if (!"대기".equals(status)) {
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
        this.status = "응답";
    }
}
