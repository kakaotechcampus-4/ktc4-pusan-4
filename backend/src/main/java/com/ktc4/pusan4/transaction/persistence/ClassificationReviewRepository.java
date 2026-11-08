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

/** 판정 대상 조건을 쓰는 분류 확인 목록(findRows)은 {@link ClassificationReviewRepositoryCustom} 에 있다. */
interface ClassificationReviewRepository
    extends Repository<ClassificationReviewEntity, UUID>, ClassificationReviewRepositoryCustom {

    ClassificationReviewEntity save(ClassificationReviewEntity review);

    List<ClassificationReviewEntity> saveAll(Iterable<ClassificationReviewEntity> reviews);

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
