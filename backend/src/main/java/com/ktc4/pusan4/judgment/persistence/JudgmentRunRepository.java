package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface JudgmentRunRepository extends Repository<JudgmentRunEntity, UUID> {

    JudgmentRunEntity save(JudgmentRunEntity run);

    Optional<JudgmentRunEntity> findById(UUID runId);

    // 실행기와 정리 작업이 같은 run 을 동시에 바꾸지 않도록 run 행을 잠근다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select run from JudgmentRunEntity run where run.id = :runId")
    Optional<JudgmentRunEntity> findByIdForUpdate(@Param("runId") UUID runId);

    // 잠금을 기다린 뒤에는 바뀐 행으로 조건을 다시 본다. 그 사이 진행한 run 은 빠진다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select run
        from JudgmentRunEntity run
        where run.status in (
            com.ktc4.pusan4.judgment.domain.JudgmentRunStatus.QUEUED,
            com.ktc4.pusan4.judgment.domain.JudgmentRunStatus.RUNNING
        )
          and run.lastProgressAt < :cutoff
        """)
    List<JudgmentRunEntity> findStaleForUpdate(@Param("cutoff") OffsetDateTime cutoff);

    @Query("""
        select run
        from JudgmentRunEntity run, UploadBatchEntity batch
        where run.id = :runId
          and run.batchId = batch.id
          and batch.userId = :userId
        """)
    Optional<JudgmentRunEntity> findForUser(@Param("runId") UUID runId, @Param("userId") UUID userId);
}
