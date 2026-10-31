package com.ktc4.pusan4.transaction.persistence;

import org.springframework.data.repository.Repository;

import java.util.Optional;
import java.util.UUID;

interface IdempotencyKeyRepository extends Repository<IdempotencyKeyEntity, UUID> {

    Optional<IdempotencyKeyEntity> findByUserIdAndKey(UUID userId, String key);
}
