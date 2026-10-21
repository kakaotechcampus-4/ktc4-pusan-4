package com.ktc4.pusan4.transaction.persistence;

import com.ktc4.pusan4.shared.api.ApiException;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * 같은 사용자의 업로드와 batch 삭제를 한 줄로 세운다. 호출한 트랜잭션이 끝날 때 풀린다.
 * <ul>
 *   <li>업로드끼리: 두 업로드가 같은 fileHash·naturalKey 를 동시에 "없음"으로 보고 둘 다 INSERT 해 UNIQUE 위반이 500 으로 나가는 것을 막는다.</li>
 *   <li>업로드와 삭제: 업로드가 중복이라 건너뛴 거래를 동시에 돌던 삭제가 CASCADE 로 지워, 그 거래가 어느 batch 에도 남지 않는 것을 막는다(#147 리뷰).</li>
 * </ul>
 * 사용자가 없으면(탈퇴 직후 남은 토큰 등) UserService 와 같이 401 이다.
 */
@Component
class UserWriteLock {

    private final EntityManager entityManager;

    UserWriteLock(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    void lock(UUID userId) {
        List<?> rows = entityManager.createNativeQuery("select id from app_user where id = :userId for update")
            .setParameter("userId", userId)
            .getResultList();
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "사용자를 찾을 수 없습니다.");
        }
    }
}
