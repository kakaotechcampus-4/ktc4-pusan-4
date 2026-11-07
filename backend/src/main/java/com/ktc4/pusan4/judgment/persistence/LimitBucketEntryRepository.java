package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

interface LimitBucketEntryRepository extends Repository<LimitBucketEntryEntity, Long> {

    LimitBucketEntryEntity save(LimitBucketEntryEntity entry);

    void delete(LimitBucketEntryEntity entry);

    @Query("""
        select entry
        from LimitBucketEntryEntity entry
        where entry.userId = :userId
          and entry.taxYear = :taxYear
          and entry.bucketCode = :bucketCode
        """)
    List<LimitBucketEntryEntity> findEntries(
        @Param("userId") UUID userId,
        @Param("taxYear") int taxYear,
        @Param("bucketCode") String bucketCode
    );

    /** 이 버킷에 항목이 남아 있는 과세연도. */
    @Query("""
        select distinct entry.taxYear
        from LimitBucketEntryEntity entry
        where entry.userId = :userId
          and entry.bucketCode = :bucketCode
        """)
    List<Integer> findTaxYears(@Param("userId") UUID userId, @Param("bucketCode") String bucketCode);

    /** 판정마다의 태그 금액과 한도 인정액. 연도 요약과 한도 합계(api.md 3.7)가 쓴다. */
    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.LimitBucketEntryRepository$EntryAmount(
            entry.judgmentId, entry.taxYear, entry.taggedAmount, entry.allowedAmount)
        from LimitBucketEntryEntity entry
        where entry.userId = :userId
          and entry.bucketCode = :bucketCode
        """)
    List<EntryAmount> findEntryAmounts(@Param("userId") UUID userId, @Param("bucketCode") String bucketCode);

    /** 이 batch 거래의 판정이 들어 있는 과세연도. 항목은 현재 판정에만 있다(LimitSettlementService). */
    @Query("""
        select distinct entry.taxYear
        from LimitBucketEntryEntity entry, JudgmentEntity judgment, TransactionRecordEntity transaction
        where entry.judgmentId = judgment.id
          and judgment.transactionId = transaction.id
          and entry.userId = :userId
          and entry.bucketCode = :bucketCode
          and transaction.batchId = :batchId
        """)
    List<Integer> findTaxYearsOfBatch(
        @Param("userId") UUID userId,
        @Param("bucketCode") String bucketCode,
        @Param("batchId") UUID batchId
    );

    record EntryAmount(UUID judgmentId, int taxYear, long taggedAmount, long allowedAmount) {
    }
}
