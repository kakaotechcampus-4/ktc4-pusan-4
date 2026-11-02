package com.ktc4.pusan4.handoff.persistence;

import com.ktc4.pusan4.handoff.domain.HandoffNote;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.ArrayList;
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

    // 지운 거래는 FK CASCADE 로 빠진다. 넣은 순서를 따로 저장하지 않아 거래 id 순이다.
    @ElementCollection
    @CollectionTable(name = "handoff_note_transaction", joinColumns = @JoinColumn(name = "handoff_note_id"))
    @Column(name = "transaction_id")
    @OrderBy
    private List<UUID> transactionIds = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected HandoffNoteEntity() {
    }

    HandoffNoteEntity(UUID id, UUID userId, String text, List<UUID> transactionIds, OffsetDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.text = text;
        this.transactionIds = new ArrayList<>(transactionIds);
        this.createdAt = createdAt;
    }

    HandoffNote toDomain() {
        return new HandoffNote(id, text, List.copyOf(transactionIds), createdAt);
    }
}
