package com.ktc4.pusan4.handoff.persistence;

import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.UUID;

interface HandoffNoteRepository extends Repository<HandoffNoteEntity, UUID> {

    HandoffNoteEntity save(HandoffNoteEntity entity);

    List<HandoffNoteEntity> findByUserIdOrderByCreatedAtAscIdAsc(UUID userId);
}
