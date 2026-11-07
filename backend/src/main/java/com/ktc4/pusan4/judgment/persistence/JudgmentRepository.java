package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 판정 대상 조건을 쓰는 조회(findPage, findCurrentLimitTagged)는 {@link JudgmentRepositoryCustom} 에 있다. */
interface JudgmentRepository extends Repository<JudgmentEntity, UUID>, JudgmentRepositoryCustom {

    JudgmentEntity save(JudgmentEntity judgment);

    @Query("""
        select judgment
        from JudgmentEntity judgment, TransactionRecordEntity transaction
        where judgment.id = :judgmentId
          and transaction.id = judgment.transactionId
          and transaction.userId = :userId
        """)
    Optional<JudgmentEntity> findForUser(@Param("judgmentId") UUID judgmentId, @Param("userId") UUID userId);

    // 거래마다 override 를 뺀 최신 자동 판정의 verdict. 소명 대기(api.md 3.11)를 가린다.
    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.JudgmentRepository$AutomaticVerdict(
            judgment.transactionId, judgment.verdict)
        from JudgmentEntity judgment
        where judgment.transactionId in :transactionIds
          and judgment.judgmentOverrideId is null
          and judgment.revision = (
            select max(latest.revision)
            from JudgmentEntity latest
            where latest.transactionId = judgment.transactionId
              and latest.judgmentOverrideId is null
          )
        """)
    List<AutomaticVerdict> findLatestAutomaticVerdicts(@Param("transactionIds") Collection<UUID> transactionIds);

    record AutomaticVerdict(UUID transactionId, String verdict) {
    }

    // 이 거래들의 판정 중 하나라도(이전 revision 포함) 가능이면서 limit_bucket 이 :bucket 인지.
    @Query("""
        select count(judgment) > 0
        from JudgmentEntity judgment
        where judgment.transactionId in :transactionIds
          and judgment.verdict = 'AVAILABLE'
          and function('jsonb_extract_path_text', judgment.attributes, 'limit_bucket') = :bucket
        """)
    boolean existsLimitTagged(@Param("transactionIds") Collection<UUID> transactionIds, @Param("bucket") String bucket);

    /** finalAmount 는 금액 계산 전에 저장된 판정이면 비어 있다. */
    record LimitTagged(UUID judgmentId, LocalDate approvedAt, Long finalAmount, long amount) {
    }

    // override 가 아닌 최신 revision. override 를 해제하면 현재 판정이 이것으로 돌아간다(api.md 3.8).
    @Query("""
        select judgment.id
        from JudgmentEntity judgment
        where judgment.transactionId = :transactionId
          and judgment.judgmentOverrideId is null
        order by judgment.revision desc
        limit 1
        """)
    Optional<UUID> findLatestAutomaticId(@Param("transactionId") UUID transactionId);

    @Query("""
        select coalesce(max(judgment.revision), 0) + 1
        from JudgmentEntity judgment
        where judgment.transactionId = :transactionId
        """)
    int findNextRevision(@Param("transactionId") UUID transactionId);
}
