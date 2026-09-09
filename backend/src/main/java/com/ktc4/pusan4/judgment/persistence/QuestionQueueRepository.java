package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface QuestionQueueRepository extends Repository<QuestionQueueEntity, UUID> {

    QuestionQueueEntity save(QuestionQueueEntity question);

    @Query("""
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
        """)
    Optional<QuestionQueueEntity> findForUser(
        @Param("questionId") UUID questionId,
        @Param("userId") UUID userId
    );
}
