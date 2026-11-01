package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

interface StatuteVersionRepository extends Repository<StatuteVersionEntity, Long> {

    Optional<StatuteVersionEntity> findById(Long id);

    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.StatuteVersionRepository$VersionPeriod(
            statute.id, statute.statuteId, statute.effectiveFrom, statute.effectiveTo)
        from StatuteVersionEntity statute
        where statute.statuteId in :statuteIds
        """)
    List<VersionPeriod> findPeriods(@Param("statuteIds") Collection<String> statuteIds);

    record VersionPeriod(long id, String statuteId, LocalDate effectiveFrom, LocalDate effectiveTo) {

        /** effective_from 은 포함, effective_to 는 제외. effective_to 가 없으면 현행이다. */
        boolean isEffectiveOn(LocalDate date) {
            return !effectiveFrom.isAfter(date) && (effectiveTo == null || effectiveTo.isAfter(date));
        }
    }
}
