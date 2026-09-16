package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface UserFactRepository extends Repository<UserFactEntity, UUID> {

    UserFactEntity save(UserFactEntity fact);

    Optional<UserFactEntity> findFirstByUserIdAndScopeKeyAndFactTypeOrderByVersionDesc(
        UUID userId, String scopeKey, String factType
    );

    @Query("""
        select fact
        from UserFactEntity fact
        where fact.userId = :userId
          and not exists (
            select newer.id
            from UserFactEntity newer
            where newer.userId = fact.userId
              and newer.scopeKey = fact.scopeKey
              and newer.factType = fact.factType
              and newer.version > fact.version
          )
        order by fact.scopeKey, fact.factType
        """)
    List<UserFactEntity> findAllLatest(@Param("userId") UUID userId);

    @Query("""
        select coalesce(max(fact.version), 0) + 1
        from UserFactEntity fact
        where fact.userId = :userId
          and fact.scopeKey = :scopeKey
          and fact.factType = :factType
        """)
    int findNextVersion(
        @Param("userId") UUID userId,
        @Param("scopeKey") String scopeKey,
        @Param("factType") String factType
    );

    // app_user 는 매핑 엔티티가 없어 native 로 행을 잠근다(채번 직렬화용).
    // for no key update: 채번끼리는 여전히 상호배제하되, 키를 안 건드린다고 선언해
    // 같은 사용자의 자식행 INSERT(FK 검사의 for key share)를 막지 않는다.
    @Query(value = "select id from app_user where id = :userId for no key update", nativeQuery = true)
    Optional<UUID> lockUser(@Param("userId") UUID userId);
}
