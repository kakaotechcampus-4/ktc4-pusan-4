package com.ktc4.pusan4.user.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface UserContextRepository extends Repository<UserContextEntity, UUID> {

    UserContextEntity save(UserContextEntity entity);

    Optional<UserContextEntity> findById(UUID id);

    Optional<UserContextEntity> findFirstByUserIdOrderByVersionDesc(UUID userId);

    Optional<UserContextEntity> findByUserIdAndVersion(UUID userId, int version);

    List<UserContextEntity> findByUserIdOrderByVersionAsc(UUID userId);

    @Query("""
        select coalesce(max(context.version), 0)
        from UserContextEntity context
        where context.userId = :userId
        """)
    int findLatestVersion(@Param("userId") UUID userId);
}
