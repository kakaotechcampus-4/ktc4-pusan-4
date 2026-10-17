package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UploadBatchRepository extends Repository<UploadBatchEntity, UUID> {

    boolean existsByIdAndUserId(UUID id, UUID userId);

    Optional<UploadBatchEntity> findById(UUID id);

    Optional<UploadBatchEntity> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndFileHash(UUID userId, String fileHash);

    /** 업로드 배치 목록 (api.md 3.3). createdAt 이 같으면 id 로 순서를 고정한다. */
    Page<UploadBatchEntity> findByUserIdOrderByCreatedAtDescIdDesc(UUID userId, Pageable pageable);

    /**
     * batch 를 지운다. 종속 데이터는 FK ON DELETE CASCADE 가 지운다(V7, api.md §6).
     * Idempotency-Key 행은 남고 batch_id 만 NULL 이 된다(V12, 410 IDEMPOTENCY_RESULT_DELETED).
     *
     * @return 지운 행 수. 없거나 남의 batch 면 0
     */
    @Modifying
    @Query("""
        delete from UploadBatchEntity batch
        where batch.id = :batchId
          and batch.userId = :userId
        """)
    int deleteOwned(@Param("batchId") UUID batchId, @Param("userId") UUID userId);
}
