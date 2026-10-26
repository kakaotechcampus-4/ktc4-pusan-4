package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

interface JudgmentOverrideRepository extends Repository<JudgmentOverrideEntity, UUID> {

    @Query("""
        select override.transactionId
        from JudgmentOverrideEntity override
        where override.transactionId in :transactionIds
          and override.active = true
        """)
    List<UUID> findActiveTransactionIds(@Param("transactionIds") Collection<UUID> transactionIds);
}
