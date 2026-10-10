package com.ktc4.pusan4.user.persistence;

import org.springframework.data.repository.Repository;

import java.util.Optional;
import java.util.UUID;

interface AppUserRepository extends Repository<AppUserEntity, UUID> {

    Optional<AppUserEntity> findById(UUID id);
}
