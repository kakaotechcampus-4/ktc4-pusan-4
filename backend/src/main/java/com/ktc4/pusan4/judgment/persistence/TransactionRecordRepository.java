package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRecordRepository extends Repository<TransactionRecordEntity, UUID> {

    Optional<TransactionRecordEntity> findById(UUID transactionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select transaction
        from TransactionRecordEntity transaction
        where transaction.id = :transactionId
        """)
    Optional<TransactionRecordEntity> findByIdForUpdate(
        @Param("transactionId") UUID transactionId
    );

    /** 업로드 중복 건너뛰기용. 이 사용자가 이미 가진 naturalKey 만 돌려준다(api.md 3.3, UNIQUE(user_id, natural_key)). */
    @Query("""
        select transaction.naturalKey
        from TransactionRecordEntity transaction
        where transaction.userId = :userId
          and transaction.naturalKey in :naturalKeys
        """)
    List<String> findExistingNaturalKeys(
        @Param("userId") UUID userId,
        @Param("naturalKeys") Collection<String> naturalKeys
    );
}
