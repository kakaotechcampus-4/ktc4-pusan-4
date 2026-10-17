package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface QuestionQueueRepository extends Repository<QuestionQueueEntity, UUID> {

    QuestionQueueEntity save(QuestionQueueEntity question);

    // 질문 목록 (api.md 3.9). 질문은 판정 → 거래를 거쳐 사용자에 닿는다.
    // 지금 판정 대상인 거래의 질문만 남긴다. 조건은 TransactionRecordRepository.findRunTargetIds 와 같다.
    // 질문은 지우지 않으므로 거래를 다시 포함하면 돌아온다. 거래를 지정해도 거른다(api.md 3.9).
    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository$QuestionRow(
            question, transaction.id, transaction.batchId)
        from QuestionQueueEntity question, JudgmentEntity judgment, TransactionRecordEntity transaction
        where question.judgmentId = judgment.id
          and judgment.transactionId = transaction.id
          and transaction.userId = :userId
          and (:batchId is null or transaction.batchId = :batchId)
          and (:transactionId is null or transaction.id = :transactionId)
          and transaction.classificationStatus = 'CLASSIFIED'
          and (
            (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
            or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
          )
        order by question.createdAt, question.id
        """)
    List<QuestionRow> findRows(
        @Param("userId") UUID userId,
        @Param("batchId") UUID batchId,
        @Param("transactionId") UUID transactionId
    );

    record QuestionRow(QuestionQueueEntity question, UUID transactionId, UUID batchId) {
    }

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

    @Query("""
        select transaction.batchId
        from QuestionQueueEntity question,
             JudgmentEntity judgment,
             TransactionRecordEntity transaction
        where question.id = :questionId
          and question.judgmentId = judgment.id
          and judgment.transactionId = transaction.id
        """)
    UUID findBatchId(@Param("questionId") UUID questionId);

    // 새 revision 이 생기면 같은 거래의 이전 revision 에 남은 대기 질문은 더 필요 없다 (api.md 3.12).
    // 아직 필요한 질문은 새 revision 이 다시 만든다. 답한 질문(ANSWERED)은 이력이라 그대로 둔다.
    @Modifying
    @Query("""
        update QuestionQueueEntity question
        set question.status = 'CANCELED'
        where question.status = 'PENDING'
          and question.judgmentId in (
            select judgment.id
            from JudgmentEntity judgment
            where judgment.transactionId = :transactionId
              and judgment.id <> :judgmentId
          )
        """)
    int cancelPendingOfOtherRevisions(
        @Param("transactionId") UUID transactionId,
        @Param("judgmentId") UUID judgmentId
    );
}
