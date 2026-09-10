package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface TransactionRecordRepository extends Repository<TransactionRecordEntity, UUID> {

    // @Lock(PESSIMISTIC_WRITE) 는 PostgreSQL 에서 SELECT ... FOR UPDATE 를 생성한다.
    // (UserFactRepository.lockUser 의 native `for no key update` 와 다른 잠금이니 혼동 말 것.)
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
