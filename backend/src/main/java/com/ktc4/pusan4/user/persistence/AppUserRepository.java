package com.ktc4.pusan4.user.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

interface AppUserRepository extends Repository<AppUserEntity, UUID> {

    Optional<AppUserEntity> findById(UUID id);

    Optional<AppUserEntity> findByEmail(String email);

    /** 데모 가입. 같은 이메일로 동시에 처음 로그인해도 한 행만 남는다(email UNIQUE). */
    @Modifying
    @Query(value = "insert into app_user(id, email) values (:id, :email) on conflict (email) do nothing",
        nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("email") String email);

    /** 사용자 단위로 직렬화해야 하는 쓰기(Context 버전 채번 등) 앞에서 잡는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select appUser
        from AppUserEntity appUser
        where appUser.id = :userId
        """)
    Optional<AppUserEntity> findByIdForUpdate(@Param("userId") UUID userId);

    /**
     * 탈퇴. 사용자 소유 데이터(문진, 업로드와 그 파생 데이터, 답변, 개인 가맹점 사전, 한도 집계,
     * Idempotency-Key)는 FK ON DELETE CASCADE 가 지운다(V7·V12). 공용 법령·전역 사전·룰 후보는 남는다.
     *
     * @return 지운 행 수. 없으면 0
     */
    @Modifying
    @Query("""
        delete from AppUserEntity appUser
        where appUser.id = :userId
        """)
    int deleteUser(@Param("userId") UUID userId);
}
