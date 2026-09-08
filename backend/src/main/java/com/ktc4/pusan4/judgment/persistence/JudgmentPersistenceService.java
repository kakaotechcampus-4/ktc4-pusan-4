package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.shared.UuidGenerator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class JudgmentPersistenceService {

    private final EntityManager entityManager;
    private final UuidGenerator uuidGenerator;

    public JudgmentPersistenceService(EntityManager entityManager, UuidGenerator uuidGenerator) {
        this.entityManager = entityManager;
        this.uuidGenerator = uuidGenerator;
    }

    @Transactional
    public UUID save(SaveJudgmentCommand command) {
        Judgment judgment = command.judgment();
        UUID judgmentId = uuidGenerator.generate();
        entityManager.persist(new JudgmentEntity(
            judgmentId,
            command,
            nextRevision(command.transactionId())
        ));

        saveCitations(judgmentId, judgment.citations(), command.statuteEffectiveDate());
        judgment.questions().forEach(question ->
            entityManager.persist(new QuestionQueueEntity(uuidGenerator.generate(), judgmentId, question))
        );
        if (judgment.unmatchedReason() != null) {
            requireUnmatchedContext(command);
            entityManager.persist(new UnmatchedLogEntity(judgmentId, command));
        }
        return judgmentId;
    }

    private int nextRevision(UUID transactionId) {
        lockTransaction(transactionId);
        return entityManager.createQuery("""
                select coalesce(max(judgment.revision), 0) + 1
                from JudgmentEntity judgment
                where judgment.transactionId = :transactionId
                """, Integer.class)
            .setParameter("transactionId", transactionId)
            .getSingleResult();
    }

    private void lockTransaction(UUID transactionId) {
        entityManager.createQuery("""
                select transaction
                from TransactionRecordEntity transaction
                where transaction.id = :transactionId
                """, TransactionRecordEntity.class)
            .setParameter("transactionId", transactionId)
            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
            .getSingleResult();
    }

    private void saveCitations(UUID judgmentId, List<Citation> citations, LocalDate effectiveDate) {
        for (Citation citation : citations) {
            List<Long> versionIds = entityManager.createQuery("""
                    select statute.id
                    from StatuteVersionEntity statute
                    where statute.statuteId = :statuteId
                      and statute.effectiveFrom <= :effectiveDate
                      and (statute.effectiveTo is null or statute.effectiveTo > :effectiveDate)
                    """, Long.class)
                .setParameter("statuteId", citation.statuteId())
                .setParameter("effectiveDate", effectiveDate)
                .getResultList();
            if (versionIds.size() != 1) {
                throw new IllegalStateException(
                    "Expected one effective statute version for " + citation.statuteId()
                );
            }
            entityManager.persist(new JudgmentCitationEntity(judgmentId, versionIds.getFirst()));
        }
    }

    private static void requireUnmatchedContext(SaveJudgmentCommand command) {
        Objects.requireNonNull(command.merchantCategory(), "merchantCategory is required for unmatched log");
        Objects.requireNonNull(command.merchantRaw(), "merchantRaw is required for unmatched log");
        Objects.requireNonNull(command.industryCode(), "industryCode is required for unmatched log");
    }
}
