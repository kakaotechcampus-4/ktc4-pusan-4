package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.shared.UuidGenerator;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserFactPersistenceService {

    private final EntityManager entityManager;
    private final UuidGenerator uuidGenerator;
    private final Clock clock;

    public UserFactPersistenceService(
        EntityManager entityManager,
        UuidGenerator uuidGenerator,
        Clock clock
    ) {
        this.entityManager = entityManager;
        this.uuidGenerator = uuidGenerator;
        this.clock = clock;
    }

    @Transactional
    public UUID save(UUID userId, UserFact fact) {
        UUID factId = uuidGenerator.generate();
        entityManager.persist(new UserFactEntity(
            factId,
            userId,
            fact,
            nextVersion(userId, fact.scopeKey(), fact.factType())
        ));
        return factId;
    }

    @Transactional(readOnly = true)
    public Optional<UserFact> findLatest(UUID userId, String scopeKey, String factType) {
        return entityManager.createQuery("""
                select fact
                from UserFactEntity fact
                where fact.userId = :userId
                  and fact.scopeKey = :scopeKey
                  and fact.factType = :factType
                order by fact.version desc
                """, UserFactEntity.class)
            .setParameter("userId", userId)
            .setParameter("scopeKey", scopeKey)
            .setParameter("factType", factType)
            .setMaxResults(1)
            .getResultList()
            .stream()
            .findFirst()
            .map(UserFactEntity::toDomain);
    }

    @Transactional
    public UUID answerQuestion(UUID questionId, UUID userId, UserFact answer) {
        QuestionQueueEntity question = findQuestionForUser(questionId, userId);
        UUID factId = uuidGenerator.generate();
        entityManager.persist(new UserFactEntity(
            factId,
            userId,
            answer,
            nextVersion(userId, answer.scopeKey(), answer.factType())
        ));
        question.answer(factId, OffsetDateTime.now(clock));
        return factId;
    }

    private int nextVersion(UUID userId, String scopeKey, String factType) {
        return entityManager.createQuery("""
                select coalesce(max(fact.version), 0) + 1
                from UserFactEntity fact
                where fact.userId = :userId
                  and fact.scopeKey = :scopeKey
                  and fact.factType = :factType
                """, Integer.class)
            .setParameter("userId", userId)
            .setParameter("scopeKey", scopeKey)
            .setParameter("factType", factType)
            .getSingleResult();
    }

    private QuestionQueueEntity findQuestionForUser(UUID questionId, UUID userId) {
        return entityManager.createQuery("""
                select question
                from QuestionQueueEntity question,
                     JudgmentEntity judgment,
                     TransactionRecordEntity transaction,
                     UploadBatchEntity batch
                where question.id = :questionId
                  and question.judgmentId = judgment.id
                  and judgment.transactionId = transaction.id
                  and transaction.batchId = batch.id
                  and batch.userId = :userId
                """, QuestionQueueEntity.class)
            .setParameter("questionId", questionId)
            .setParameter("userId", userId)
            .getSingleResult();
    }
}
