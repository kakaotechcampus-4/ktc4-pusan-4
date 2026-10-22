package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface JudgmentOverrideRepository extends Repository<JudgmentOverrideEntity, UUID> {

    JudgmentOverrideEntity save(JudgmentOverrideEntity override);

    @Query("""
        select override
        from JudgmentOverrideEntity override, TransactionRecordEntity transaction
        where override.id = :overrideId
          and transaction.id = override.transactionId
          and transaction.userId = :userId
        """)
    Optional<JudgmentOverrideEntity> findForUser(@Param("overrideId") UUID overrideId, @Param("userId") UUID userId);

    @Query("""
        select override.transactionId
        from JudgmentOverrideEntity override
        where override.transactionId in :transactionIds
          and override.active = true
        """)
    List<UUID> findActiveTransactionIds(@Param("transactionIds") Collection<UUID> transactionIds);

    // 새 override 를 넣기 전에 바로 실행해야 한다. 엔티티로 끄면 Hibernate 가 insert 를 update 보다 먼저 보내
    // 거래당 활성 하나(uq_judgment_override_active_transaction)에 걸린다.
    @Modifying
    @Query("""
        update JudgmentOverrideEntity override
        set override.active = false, override.releasedAt = :releasedAt
        where override.transactionId = :transactionId
          and override.active = true
        """)
    int releaseActive(@Param("transactionId") UUID transactionId, @Param("releasedAt") OffsetDateTime releasedAt);
}
