package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface JudgmentRepository extends Repository<JudgmentEntity, UUID> {

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

    // 판정 목록 (api.md 3.7). 비어 있지 않은 조건만 건다. 범위는 셋 중 하나다.
    //  - runId: 그 Run 이 직접 만든 판정. 이후 답변·수정으로 생긴 revision 은 빠진다.
    //  - history: 모든 revision.
    //  - 현재 판정(§5): 거래가 가리키는 판정(transaction.current_judgment_id).
    //    거래를 지정하지 않으면 지금 판정 대상인 거래만 남긴다.
    //    판정 대상 조건은 TransactionRecordRepository.findRunTargetIds 와 같다.
    // yearStart 는 cast 하지 않으면 값이 있을 때 Postgres 가 "is null" 쪽 타입을 정하지 못한다(42P18).
    @Query("""
        select judgment
        from JudgmentEntity judgment, TransactionRecordEntity transaction
        where transaction.id = judgment.transactionId
          and transaction.userId = :userId
          and (:transactionId is null or transaction.id = :transactionId)
          and (:batchId is null or transaction.batchId = :batchId)
          and (cast(:yearStart as LocalDate) is null or (transaction.approvedAt >= :yearStart and transaction.approvedAt < :yearEnd))
          and (:verdict is null or judgment.verdict = :verdict)
          and (
            (:runId is not null and judgment.runId = :runId)
            or (:runId is null and :history = true)
            or (
              :runId is null and :history = false
              and judgment.id = transaction.currentJudgmentId
              and (
                :transactionId is not null
                or (
                  transaction.classificationStatus = 'CLASSIFIED'
                  and (
                    (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
                    or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
                  )
                )
              )
            )
          )
        order by judgment.computedAt desc, judgment.id desc
        """)
    Page<JudgmentEntity> findPage(
        @Param("userId") UUID userId,
        @Param("transactionId") UUID transactionId,
        @Param("batchId") UUID batchId,
        @Param("yearStart") LocalDate yearStart,
        @Param("yearEnd") LocalDate yearEnd,
        @Param("verdict") String verdict,
        @Param("runId") UUID runId,
        @Param("history") boolean history,
        Pageable pageable
    );

    // 한도 집계(LimitSettlementService) 대상: 사용자의 현재 판정(§5) 중 가능이면서 limit_bucket 이 :bucket 인 것.
    // 판정 대상 조건은 findPage 와 같다. 판정 행은 batch 의 UserFact 전부(input_facts)를 싣고 있어,
    // 엔티티로 읽으면 거래 수의 제곱만큼 메모리를 쓴다. 집계에 필요한 값만 꺼낸다.
    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.JudgmentRepository$LimitTagged(
            judgment.id, transaction.approvedAt, judgment.finalAmount, transaction.amount)
        from TransactionRecordEntity transaction, JudgmentEntity judgment
        where judgment.id = transaction.currentJudgmentId
          and transaction.userId = :userId
          and transaction.classificationStatus = 'CLASSIFIED'
          and (
            (transaction.sourceStatus = 'JUDGEABLE' and transaction.userInclusion <> 'EXCLUDED')
            or (transaction.sourceStatus = 'EXCLUDED' and transaction.userInclusion = 'INCLUDED')
          )
          and judgment.verdict = 'AVAILABLE'
          and function('jsonb_extract_path_text', judgment.attributes, 'limit_bucket') = :bucket
        """)
    List<LimitTagged> findCurrentLimitTagged(@Param("userId") UUID userId, @Param("bucket") String bucket);

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
