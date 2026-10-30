package com.ktc4.pusan4.progress.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import com.ktc4.pusan4.judgment.persistence.UploadBatchEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 진행 상황 (api.md 3.14) 에 필요한 업로드·분류 대기·판정 실행 값. */
interface ProgressRepository extends Repository<UploadBatchEntity, UUID> {

    @Query("""
        select new com.ktc4.pusan4.progress.persistence.ProgressRepository$BatchRow(
            batch.id, batch.cardIssuer, batch.periodStart, batch.periodEnd,
            (select count(transaction) from TransactionRecordEntity transaction where transaction.batchId = batch.id))
        from UploadBatchEntity batch
        where batch.id = :batchId
          and batch.userId = :userId
        """)
    Optional<BatchRow> findBatch(@Param("batchId") UUID batchId, @Param("userId") UUID userId);

    record BatchRow(UUID id, String cardIssuer, LocalDate periodStart, LocalDate periodEnd, long transactionCount) {
    }

    // 업로드 목록의 classificationPendingCount 와 같은 조건이다(UploadBatchCountRepository.countPendingReviews).
    @Query("""
        select new com.ktc4.pusan4.progress.persistence.ProgressRepository$Pending(
            count(review), coalesce(sum(transaction.amount), 0))
        from ClassificationReviewEntity review, TransactionRecordEntity transaction
        where review.transactionId = transaction.id
          and transaction.batchId = :batchId
          and review.status = 'PENDING'
          and (
            (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
            or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
          )
        """)
    Pending countPendingClassification(@Param("batchId") UUID batchId);

    record Pending(long count, long amount) {
    }

    @Query("""
        select new com.ktc4.pusan4.progress.persistence.ProgressRepository$RunRow(run.id, run.status)
        from JudgmentRunEntity run
        where run.batchId = :batchId
        order by run.createdAt desc, run.id desc
        """)
    List<RunRow> findLatestRuns(@Param("batchId") UUID batchId, Pageable pageable);

    record RunRow(UUID id, JudgmentRunStatus status) {
    }
}
