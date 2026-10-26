package com.ktc4.pusan4.merchant;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

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
