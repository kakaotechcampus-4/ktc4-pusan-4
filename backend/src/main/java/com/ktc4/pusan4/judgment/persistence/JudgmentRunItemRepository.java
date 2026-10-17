package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface JudgmentRunItemRepository extends Repository<JudgmentRunItemEntity, JudgmentRunItemEntity.Key> {

    List<JudgmentRunItemEntity> saveAll(Iterable<JudgmentRunItemEntity> items);

    Optional<JudgmentRunItemEntity> findById(JudgmentRunItemEntity.Key key);

    @Query("""
        select item.key.transactionId
        from JudgmentRunItemEntity item
        where item.key.runId = :runId
          and item.status = 'PENDING'
        order by item.key.transactionId
        """)
    List<UUID> findPendingTransactionIds(@Param("runId") UUID runId);

    @Modifying
    @Query("""
        update JudgmentRunItemEntity item
        set item.status = 'FAILED',
            item.errorCode = :errorCode,
            item.errorMessage = :message,
            item.processedAt = :now
        where item.key.runId = :runId
          and item.status = 'PENDING'
        """)
    int failPending(
        @Param("runId") UUID runId,
        @Param("errorCode") JudgmentRunItemError errorCode,
        @Param("message") String message,
        @Param("now") OffsetDateTime now
    );

    @Query("""
        select item
        from JudgmentRunItemEntity item
        where item.key.runId = :runId
          and item.status = 'FAILED'
        order by item.processedAt, item.key.transactionId
        """)
    Page<JudgmentRunItemEntity> findFailures(@Param("runId") UUID runId, Pageable pageable);
}
