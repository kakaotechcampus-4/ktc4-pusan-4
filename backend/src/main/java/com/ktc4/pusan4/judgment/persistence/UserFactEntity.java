package com.ktc4.pusan4.judgment.persistence;

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

    @Column(name = "scope_key", nullable = false)
    private String scopeKey;

    @Column(name = "fact_type", nullable = false)
    private String factType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> value;

    @Column(nullable = false)
    private int version;

    protected UserFactEntity() {
    }

    UserFactEntity(UUID id, UUID userId, UserFact fact, int version) {
        this.id = id;
        this.userId = userId;
        this.scopeKey = fact.scopeKey();
        this.factType = fact.factType();
        this.value = fact.value();
        this.version = version;
    }

    UserFact toDomain() {
        return new UserFact(scopeKey, factType, value);
    }
}
