package com.ktc4.pusan4.handoff.persistence;

import com.ktc4.pusan4.handoff.domain.HandoffNote;
import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.transaction.persistence.TransactionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 세무대리인에게 물을 질문 (docs/agent-secretary.md FR-16). 사용자 소유이고, 탈퇴하면 FK ON DELETE CASCADE 가 지운다.
 */
@Service
public class HandoffNoteService {

    private final HandoffNoteRepository noteRepository;
    private final TransactionService transactionService;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public HandoffNoteService(
        HandoffNoteRepository noteRepository,
        TransactionService transactionService,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.noteRepository = noteRepository;
        this.transactionService = transactionService;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    /** 붙인 거래가 남의 것이면 없는 거래와 같이 404 TRANSACTION_NOT_FOUND 다. 같은 거래를 두 번 적으면 한 번만 남긴다. */
    @Transactional
    public HandoffNote create(UUID userId, String text, List<UUID> transactionIds) {
        List<UUID> distinct = transactionIds.stream().distinct().toList();
        distinct.forEach(transactionId -> transactionService.get(userId, transactionId));
        return noteRepository.save(new HandoffNoteEntity(
            uuidGenerator.generate(), userId, text, distinct, OffsetDateTime.now(clock)
        )).toDomain();
    }

    /** 넣은 순서. 요약 문장이 이 순서로 번호를 붙인다. */
    @Transactional(readOnly = true)
    public List<HandoffNote> list(UUID userId) {
        return noteRepository.findByUserIdOrderByCreatedAtAscIdAsc(userId).stream()
            .map(HandoffNoteEntity::toDomain)
            .toList();
    }
}
