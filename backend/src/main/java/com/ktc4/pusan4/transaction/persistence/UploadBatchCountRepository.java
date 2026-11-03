package com.ktc4.pusan4.transaction.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * 업로드 배치 목록에 붙일 건수 (api.md 3.3). 한 페이지의 batch 를 쿼리 한 번씩으로 센다.
 * 판정 대상 조건을 쓰는 분류 대기 수(countPendingReviews)는 {@link UploadBatchCountRepositoryCustom} 에 있다.
 */
interface UploadBatchCountRepository extends Repository<ClassificationReviewEntity, UUID>, UploadBatchCountRepositoryCustom {

    @Query("""
        select new com.ktc4.pusan4.transaction.persistence.UploadBatchCountRepository$BatchCount(
            transaction.batchId, count(transaction))
        from TransactionRecordEntity transaction
        where transaction.batchId in :batchIds
        group by transaction.batchId
        """)
    List<BatchCount> countTransactions(@Param("batchIds") Collection<UUID> batchIds);

    record BatchCount(UUID batchId, Long count) {
    }
}
