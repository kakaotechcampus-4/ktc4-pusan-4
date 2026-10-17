package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface JudgmentRunRepository extends Repository<JudgmentRunEntity, UUID> {

    JudgmentRunEntity save(JudgmentRunEntity run);

    Optional<JudgmentRunEntity> findById(UUID runId);

    @Query("""
        select run
        from JudgmentRunEntity run, UploadBatchEntity batch
        where run.id = :runId
          and run.batchId = batch.id
          and batch.userId = :userId
        """)
    Optional<JudgmentRunEntity> findForUser(@Param("runId") UUID runId, @Param("userId") UUID userId);
}
