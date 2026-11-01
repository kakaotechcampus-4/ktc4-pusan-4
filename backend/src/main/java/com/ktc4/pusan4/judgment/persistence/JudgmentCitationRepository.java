package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.CitedStatute;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

interface JudgmentCitationRepository extends Repository<JudgmentCitationEntity, Long> {

    // id 가 IDENTITY 라 save() 로는 INSERT 를 묶지 못해 인용마다 한 문장씩 나간다. 판정 하나의 인용을 한 문장으로 넣는다.
    // 같은 판정에 같은 버전은 UNIQUE(judgment_id, statute_version_id) 라 원래 두 번 들어갈 수 없다.
    // flushAutomatically: 참조하는 judgment 행의 INSERT 를 먼저 보낸다. 이 쿼리는 judgment 테이블을 건드리지 않아
    // Hibernate 가 알아서 flush 하지 않는다.
    @Modifying(flushAutomatically = true)
    @Query("""
        insert into JudgmentCitationEntity (judgmentId, statuteVersionId)
        select :judgmentId, statute.id
        from StatuteVersionEntity statute
        where statute.id in :statuteVersionIds
        """)
    int insertAll(
        @Param("judgmentId") UUID judgmentId,
        @Param("statuteVersionIds") Collection<Long> statuteVersionIds
    );

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
