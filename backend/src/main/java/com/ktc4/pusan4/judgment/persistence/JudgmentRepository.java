package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

interface JudgmentRepository extends Repository<JudgmentEntity, UUID> {

    JudgmentEntity save(JudgmentEntity judgment);

    @Query("""
        select coalesce(max(judgment.revision), 0) + 1
        from JudgmentEntity judgment
        where judgment.transactionId = :transactionId
        """)
    int findNextRevision(@Param("transactionId") UUID transactionId);
}
