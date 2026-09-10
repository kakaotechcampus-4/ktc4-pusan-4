package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface TransactionRecordRepository extends Repository<TransactionRecordEntity, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select transaction
        from TransactionRecordEntity transaction
        where transaction.id = :transactionId
        """)
    Optional<TransactionRecordEntity> findByIdForUpdate(
        @Param("transactionId") UUID transactionId
    );
}
