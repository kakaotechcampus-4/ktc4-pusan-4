package com.ktc4.pusan4.merchant;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

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
}
