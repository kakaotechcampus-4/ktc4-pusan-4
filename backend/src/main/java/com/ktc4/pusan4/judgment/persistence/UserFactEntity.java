package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.AnswerSource;
import com.ktc4.pusan4.judgment.domain.UserFact;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "user_fact")
class UserFactEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "scope_key", nullable = false)
    private String scopeKey;

    @Column(name = "fact_type", nullable = false)
    private String factType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> value;

    @Column(nullable = false)
    private int version;

    @Column(nullable = false)
    private String source;

    /** 답을 취소한 version. 값은 비어 있고, 최신 version 이 이것이면 그 질문에는 답이 없다 (V23). */
    @Column(nullable = false)
    private boolean withdrawn;

    protected UserFactEntity() {
    }

    UserFactEntity(UUID id, UUID userId, UUID batchId, UserFact fact, int version) {
        this(id, userId, batchId, fact, version, AnswerSource.USER);
    }

    UserFactEntity(UUID id, UUID userId, UUID batchId, UserFact fact, int version, AnswerSource source) {
        this.id = id;
        this.userId = userId;
        this.batchId = batchId;
        this.scopeKey = fact.scopeKey();
        this.factType = fact.factType();
        this.value = fact.value();
        this.version = version;
        this.source = source.name();
    }

    /** 답 취소를 새 version 으로 남긴다. 사용자가 한 일이라 출처는 USER 다. */
    static UserFactEntity withdrawal(
        UUID id, UUID userId, UUID batchId, String scopeKey, String factType, int version
    ) {
        UserFactEntity entity =
            new UserFactEntity(id, userId, batchId, new UserFact(scopeKey, factType, Map.of()), version);
        entity.withdrawn = true;
        return entity;
    }

    UUID id() {
        return id;
    }

    int version() {
        return version;
    }

    boolean withdrawn() {
        return withdrawn;
    }

    AnswerSource source() {
        return AnswerSource.valueOf(source);
    }

    UserFact toDomain() {
        return new UserFact(scopeKey, factType, value);
    }
}
