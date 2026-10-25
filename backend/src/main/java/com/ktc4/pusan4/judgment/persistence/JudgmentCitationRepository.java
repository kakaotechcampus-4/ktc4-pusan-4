package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.CitedStatute;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

interface JudgmentCitationRepository extends Repository<JudgmentCitationEntity, Long> {

    JudgmentCitationEntity save(JudgmentCitationEntity citation);

    @Query("""
        select new com.ktc4.pusan4.judgment.persistence.JudgmentCitationRepository$CitationRow(
            citation.judgmentId, statute.id, statute.statuteId)
        from JudgmentCitationEntity citation, StatuteVersionEntity statute
        where citation.judgmentId in :judgmentIds
          and statute.id = citation.statuteVersionId
        order by statute.id
        """)
    List<CitationRow> findRows(@Param("judgmentIds") Collection<UUID> judgmentIds);

    record CitationRow(UUID judgmentId, long statuteVersionId, String statuteId) {

        CitedStatute toCited() {
            return new CitedStatute(statuteVersionId, statuteId);
        }
    }
}
