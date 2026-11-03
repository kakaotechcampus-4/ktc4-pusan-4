package com.ktc4.pusan4.merchant;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class MerchantDictionaryRepository {

    private final EntityManager entityManager;

    public MerchantDictionaryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public Optional<MerchantClassification> find(UUID userId, String pattern) {
        return entityManager.createQuery("""
                select new com.ktc4.pusan4.merchant.MerchantClassification(
                    merchant.userId,
                    merchant.pattern,
                    merchant.merchantNorm,
                    merchant.merchantCategory,
                    merchant.source,
                    merchant.resolvedEvidence,
                    merchant.confidence
                )
                from MerchantDictionaryEntity merchant
                where merchant.pattern = :pattern
                  and (merchant.userId = :userId or merchant.userId is null)
                order by case when merchant.userId = :userId then 0 else 1 end
                """, MerchantClassification.class)
            .setParameter("pattern", pattern)
            .setParameter("userId", userId)
            .setMaxResults(1)
            .getResultList()
            .stream()
            .findFirst();
    }

    /**
     * 사용자의 분류 응답을 개인 사전에 남긴다 (api.md 3.5, docs/backend_api_plan.md B8). 같은 pattern 이 있으면 덮어쓴다.
     * pattern 은 거래의 merchantNorm 이다. 분류기가 같은 값으로 사전을 찾는다({@code ClassificationResult}).
     */
    public void savePersonal(UUID userId, String merchantNorm, String merchantCategory, OffsetDateTime resolvedAt) {
        entityManager.createNativeQuery("""
                insert into merchant_dict (user_id, pattern, merchant_norm, merchant_category, source, resolved_at,
                                           confidence)
                values (:userId, :pattern, :pattern, :category, 'user', :resolvedAt, 1)
                on conflict (user_id, pattern) where user_id is not null
                do update set merchant_category = excluded.merchant_category,
                              source = excluded.source,
                              resolved_at = excluded.resolved_at,
                              confidence = excluded.confidence
                """)
            .setParameter("userId", userId)
            .setParameter("pattern", merchantNorm)
            .setParameter("category", merchantCategory)
            .setParameter("resolvedAt", resolvedAt)
            .executeUpdate();
    }

    /**
     * {@code patterns} 중 사전에 있는 행을 개인({@code userId})·전역 구분 없이 모두 돌려준다.
     * 업로드 한 건의 가맹점을 쿼리 한 번으로 조회하려는 용도다. 어느 쪽이 이기는지는 호출하는 쪽이 정한다.
     */
    public List<MerchantClassification> findAll(UUID userId, Collection<String> patterns) {
        if (patterns.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery("""
                select new com.ktc4.pusan4.merchant.MerchantClassification(
                    merchant.userId,
                    merchant.pattern,
                    merchant.merchantNorm,
                    merchant.merchantCategory,
                    merchant.source,
                    merchant.resolvedEvidence,
                    merchant.confidence
                )
                from MerchantDictionaryEntity merchant
                where merchant.pattern in :patterns
                  and (merchant.userId = :userId or merchant.userId is null)
                """, MerchantClassification.class)
            .setParameter("patterns", patterns)
            .setParameter("userId", userId)
            .getResultList();
    }
}
