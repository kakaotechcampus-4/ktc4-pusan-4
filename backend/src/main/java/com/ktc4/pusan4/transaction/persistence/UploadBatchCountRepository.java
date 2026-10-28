package com.ktc4.pusan4.transaction.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * 업로드 배치 목록에 붙일 건수 (api.md 3.3). 한 페이지의 batch 를 쿼리 한 번씩으로 센다.
 */
interface UploadBatchCountRepository extends Repository<ClassificationReviewEntity, UUID> {

    @Query("""
        select new com.ktc4.pusan4.transaction.persistence.UploadBatchCountRepository$BatchCount(
            transaction.batchId, count(transaction))
        from TransactionRecordEntity transaction
        where transaction.batchId in :batchIds
        group by transaction.batchId
        """)
    List<BatchCount> countTransactions(@Param("batchIds") Collection<UUID> batchIds);

    // 판정 대상(effectiveStatus = JUDGEABLE) 거래의 검토만 센다. 제외해도 검토는 남아 다시 포함하면 돌아온다.
    // 검토는 미분류 거래에만 붙으므로 분류 완료 조건은 넣지 않는다. 같은 조건을 #162 에서 한 곳으로 모은다.
    @Query("""
        select new com.ktc4.pusan4.transaction.persistence.UploadBatchCountRepository$BatchCount(
            transaction.batchId, count(review))
        from ClassificationReviewEntity review, TransactionRecordEntity transaction
        where review.transactionId = transaction.id
          and transaction.batchId in :batchIds
          and review.status = 'PENDING'
          and (
            (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
            or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
          )
        group by transaction.batchId
        """)
    List<BatchCount> countPendingReviews(@Param("batchIds") Collection<UUID> batchIds);

    record BatchCount(UUID batchId, Long count) {
    }
}
