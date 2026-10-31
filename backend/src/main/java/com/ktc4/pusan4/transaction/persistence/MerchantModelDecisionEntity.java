package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.merchant.classify.ModelDecision;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 분류 모델이 미분류 거래에 낸 답 (V15). 업로드가 남기고, 분류 확인 목록이 후보를 읽는다. 사전에는 쓰지 않는다.
 */
@Entity
@Table(name = "merchant_model_decision")
class MerchantModelDecisionEntity {

    @Id
    @Column(name = "transaction_id")
    private UUID transactionId;

    private String category;

    private double confidence;

    private Double known;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> suggestions;

    @Column(nullable = false)
    private boolean refused;

    @Column(nullable = false)
    private String model;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected MerchantModelDecisionEntity() {
    }

    MerchantModelDecisionEntity(UUID transactionId, ModelDecision decision, OffsetDateTime now) {
        this.transactionId = transactionId;
        this.category = decision.category();
        this.confidence = decision.confidence();
        this.known = decision.known();
        this.suggestions = decision.suggestions();
        this.refused = decision.refused();
        this.model = decision.model();
        this.createdAt = now;
    }

    UUID transactionId() {
        return transactionId;
    }

    boolean refused() {
        return refused;
    }

    List<String> suggestions() {
        return suggestions;
    }
}
