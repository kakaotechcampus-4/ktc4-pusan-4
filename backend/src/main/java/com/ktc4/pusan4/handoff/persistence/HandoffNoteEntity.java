package com.ktc4.pusan4.handoff.persistence;

import com.ktc4.pusan4.handoff.domain.HandoffNote;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "handoff_note")
class HandoffNoteEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String text;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "transaction_ids", nullable = false, columnDefinition = "jsonb")
    private List<String> transactionIds;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected HandoffNoteEntity() {
    }

    HandoffNoteEntity(UUID id, UUID userId, String text, List<UUID> transactionIds, OffsetDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.text = text;
        this.transactionIds = transactionIds.stream().map(UUID::toString).toList();
        this.createdAt = createdAt;
    }

    HandoffNote toDomain() {
        return new HandoffNote(id, text, transactionIds.stream().map(UUID::fromString).toList(), createdAt);
    }
}
