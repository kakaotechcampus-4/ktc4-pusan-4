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

    /** 판정마다의 한도 인정액. 현재 결과 요약(api.md 3.7)이 이 버킷 판정의 finalAmount 대신 쓴다. */
    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.LimitBucketEntryRepository$AllowedAmount(
            entry.judgmentId, entry.allowedAmount)
        from LimitBucketEntryEntity entry
        where entry.userId = :userId
          and entry.bucketCode = :bucketCode
        """)
    List<AllowedAmount> findAllowedAmounts(@Param("userId") UUID userId, @Param("bucketCode") String bucketCode);

    record AllowedAmount(UUID judgmentId, long allowedAmount) {
    }
}
