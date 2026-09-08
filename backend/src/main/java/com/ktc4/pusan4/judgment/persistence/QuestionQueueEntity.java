package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.QuestionSpec;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;

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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> options;

    protected QuestionQueueEntity() {
    }

    QuestionQueueEntity(UUID judgmentId, QuestionSpec question) {
        this.id = UUID.randomUUID();
        this.judgmentId = judgmentId;
        this.reasonCode = question.code();
        this.questionText = question.text();
        this.groupKey = question.groupBy();
        this.options = question.options();
    }
}
