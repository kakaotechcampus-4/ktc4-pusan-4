package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

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

    @Query("""
        select item
        from JudgmentRunItemEntity item
        where item.key.runId = :runId
          and item.status = 'FAILED'
        order by item.processedAt, item.key.transactionId
        """)
    Page<JudgmentRunItemEntity> findFailures(@Param("runId") UUID runId, Pageable pageable);
}
