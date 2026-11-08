package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 판정 대상 조건을 쓰는 조회(findRunTargetIds 등)는 {@link TransactionRecordRepositoryCustom} 에 있다. */
public interface TransactionRecordRepository
    extends Repository<TransactionRecordEntity, UUID>, TransactionRecordRepositoryCustom {

    TransactionRecordEntity save(TransactionRecordEntity transaction);

    Optional<TransactionRecordEntity> findById(UUID transactionId);

    List<TransactionRecordEntity> findByIdIn(Collection<UUID> transactionIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select transaction
        from TransactionRecordEntity transaction
        where transaction.id = :transactionId
        """)
    Optional<TransactionRecordEntity> findByIdForUpdate(
        @Param("transactionId") UUID transactionId
    );

    @Query("select transaction.currentJudgmentId from TransactionRecordEntity transaction where transaction.id = :transactionId")
    Optional<UUID> findCurrentJudgmentId(@Param("transactionId") UUID transactionId);

    // 현재 판정(api.md §5)을 바꾼다. 부르는 쪽이 거래 락을 잡은 뒤에 부른다. 엔티티 필드는 읽기 전용이라
    // (TransactionRecordEntity.currentJudgmentId) 여기서만 쓴다. 먼저 flush 해 새 판정 행이 들어간 뒤에 가리킨다.
    @Modifying(flushAutomatically = true)
    @Query(value = "update transaction set current_judgment_id = :judgmentId where id = :transactionId", nativeQuery = true)
    void pointCurrentJudgment(@Param("transactionId") UUID transactionId, @Param("judgmentId") UUID judgmentId);

    // 자동 판정 저장용. 활성 override 가 있으면 현재 판정은 그 override revision 그대로다(api.md 3.8).
    // 확인과 갱신을 한 문장으로 해 판정마다 왕복을 하나만 더한다(run 은 거래마다 판정을 저장한다).
    @Modifying(flushAutomatically = true)
    @Query(value = """
        update transaction set current_judgment_id = :judgmentId
        where id = :transactionId
          and not exists (select 1 from judgment_override o where o.transaction_id = :transactionId and o.active)
        """, nativeQuery = true)
    void pointCurrentJudgmentUnlessOverridden(
        @Param("transactionId") UUID transactionId, @Param("judgmentId") UUID judgmentId);

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
