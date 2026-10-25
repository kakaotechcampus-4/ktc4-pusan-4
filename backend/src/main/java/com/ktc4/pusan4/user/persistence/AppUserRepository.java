package com.ktc4.pusan4.user.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface AppUserRepository extends Repository<AppUserEntity, UUID> {

    Optional<AppUserEntity> findById(UUID id);

    /** 사용자 단위로 직렬화해야 하는 쓰기(Context 버전 채번 등) 앞에서 잡는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select appUser
        from AppUserEntity appUser
        where appUser.id = :userId
        """)
    Optional<AppUserEntity> findByIdForUpdate(@Param("userId") UUID userId);
}
