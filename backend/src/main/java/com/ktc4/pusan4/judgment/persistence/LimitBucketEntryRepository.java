package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

interface LimitBucketEntryRepository extends Repository<LimitBucketEntryEntity, Long> {

    /** 이 버킷에 항목이 남아 있는 과세연도. */
    @Query("""
        select distinct entry.taxYear
        from LimitBucketEntryEntity entry
        where entry.userId = :userId
          and entry.bucketCode = :bucketCode
        """)
    List<Integer> findTaxYears(@Param("userId") UUID userId, @Param("bucketCode") String bucketCode);
}
