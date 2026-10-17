package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.repository.Repository;

import java.util.Optional;
import java.util.UUID;

interface UploadBatchRepository extends Repository<UploadBatchEntity, UUID> {

    boolean existsByIdAndUserId(UUID id, UUID userId);

    Optional<UploadBatchEntity> findById(UUID id);
}
