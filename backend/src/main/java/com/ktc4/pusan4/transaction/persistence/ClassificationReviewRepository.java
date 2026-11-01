package com.ktc4.pusan4.transaction.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface ClassificationReviewRepository extends Repository<ClassificationReviewEntity, UUID> {

    boolean existsByTransactionIdAndStatus(UUID transactionId, String status);

    /** 같은 요청에 응답이 동시에 와도 한 번만 해결되도록 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select review from ClassificationReviewEntity review where review.id in :reviewIds")
    List<ClassificationReviewEntity> findAllForUpdate(@Param("reviewIds") Collection<UUID> reviewIds);

    /**
     * batch 의 가장 최근 완료 run 이 쓴 문진 버전 (api.md 3.5 판정 처리). 판정 결과를 남긴 run 만 센다.
     * 판정 실행 엔티티가 트랙 A(#127)에 있어 여기 둔다. 두 스택이 develop 에 들어가면 JudgmentRunRepository 로 옮긴다.
     */
    @Query(nativeQuery = true, value = """
        select run.context_version
        from judgment_run run
        where run.batch_id = :batchId
          and run.status in ('COMPLETED', 'PARTIAL_FAILED')
        order by run.created_at desc, run.id desc
        limit 1
        """)
    Optional<Integer> findLatestCompletedRunContextVersion(@Param("batchId") UUID batchId);

    /**
     * 이 batch 의 분류 확인 요청과 거래 요약. 정렬: createdAt ASC, id ASC (api.md 3.5).
     * 지금 판정 대상(effectiveStatus = JUDGEABLE)인 거래만 본다. 제외한 거래의 요청은 지우지 않고 여기서 거른다.
     */
    @Query("""
        select new com.ktc4.pusan4.transaction.persistence.ClassificationReviewRepository$ReviewRow(
            review.id, transaction.batchId, transaction.id, review.status, review.createdAt, review.resolvedAt,
            transaction.approvedAt, transaction.merchantRaw, transaction.merchantNorm, transaction.merchantCategory,
            transaction.amount, transaction.installmentMonths)
        from ClassificationReviewEntity review, TransactionRecordEntity transaction
        where review.transactionId = transaction.id
          and transaction.userId = :userId
          and transaction.batchId = :batchId
          and (
            (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
            or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
          )
        order by review.createdAt, review.id
        """)
    List<ReviewRow> findRows(@Param("userId") UUID userId, @Param("batchId") UUID batchId);

    /** batchId 없이 부르면 사용자의 모든 batch. 정렬은 {@link #findRows(UUID, UUID)} 와 같다. */
    @Query("""
        select new com.ktc4.pusan4.transaction.persistence.ClassificationReviewRepository$ReviewRow(
            review.id, transaction.batchId, transaction.id, review.status, review.createdAt, review.resolvedAt,
            transaction.approvedAt, transaction.merchantRaw, transaction.merchantNorm, transaction.merchantCategory,
            transaction.amount, transaction.installmentMonths)
        from ClassificationReviewEntity review, TransactionRecordEntity transaction
        where review.transactionId = transaction.id
          and transaction.userId = :userId
          and (
            (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
            or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
          )
        order by review.createdAt, review.id
        """)
    List<ReviewRow> findRows(@Param("userId") UUID userId);

    record ReviewRow(
        UUID reviewId,
        UUID batchId,
        UUID transactionId,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime resolvedAt,
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        String merchantCategory,
        long amount,
        int installmentMonths
    ) {
    }
}
