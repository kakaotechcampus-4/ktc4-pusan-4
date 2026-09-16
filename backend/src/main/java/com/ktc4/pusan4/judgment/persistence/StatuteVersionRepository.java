package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

interface StatuteVersionRepository extends Repository<StatuteVersionEntity, Long> {

    @Query("""
        select statute.id
        from StatuteVersionEntity statute
        where statute.statuteId = :statuteId
          and statute.effectiveFrom <= :effectiveDate
          and (statute.effectiveTo is null or statute.effectiveTo > :effectiveDate)
        """)
    List<Long> findEffectiveVersionIds(
        @Param("statuteId") String statuteId,
        @Param("effectiveDate") LocalDate effectiveDate
    );
}
