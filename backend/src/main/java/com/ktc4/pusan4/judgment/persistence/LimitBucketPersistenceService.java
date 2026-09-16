package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.limit.AnnualFinalizationPolicy;
import com.ktc4.pusan4.judgment.limit.FinalizationConditions;
import com.ktc4.pusan4.judgment.limit.FinalizationDecision;
import com.ktc4.pusan4.judgment.limit.LimitAllocation;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LimitBucketPersistenceService {

    private final EntityManager entityManager;

    public LimitBucketPersistenceService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Transactional
    public void replaceProvisional(
        UUID userId,
        int taxYear,
        String bucketCode,
        List<LimitAllocation> allocations
    ) {
        Map<UUID, LimitAllocation> incoming = byJudgmentId(allocations);
        for (LimitBucketEntryEntity existing : findEntries(userId, taxYear, bucketCode)) {
            LimitAllocation allocation = incoming.remove(existing.judgmentId());
            if (allocation == null) {
                entityManager.remove(existing);
            } else {
                existing.updateProvisional(allocation);
            }
        }
        incoming.values().forEach(allocation ->
            entityManager.persist(new LimitBucketEntryEntity(
                userId, taxYear, bucketCode, allocation
            ))
        );
    }

    @Transactional
    public void finalizeEntries(
        UUID userId,
        int taxYear,
        String bucketCode,
        FinalizationConditions conditions
    ) {
        FinalizationDecision decision = AnnualFinalizationPolicy.evaluate(conditions);
        if (!decision.ready()) {
            throw new IllegalStateException("Cannot finalize limit bucket: " + decision.reasons());
        }
        findEntries(userId, taxYear, bucketCode)
            .forEach(LimitBucketEntryEntity::finalizeEntry);
    }

    private List<LimitBucketEntryEntity> findEntries(
        UUID userId,
        int taxYear,
        String bucketCode
    ) {
        return entityManager.createQuery("""
                select entry
                from LimitBucketEntryEntity entry
                where entry.userId = :userId
                  and entry.taxYear = :taxYear
                  and entry.bucketCode = :bucketCode
                """, LimitBucketEntryEntity.class)
            .setParameter("userId", userId)
            .setParameter("taxYear", taxYear)
            .setParameter("bucketCode", bucketCode)
            .getResultList();
    }

    private static Map<UUID, LimitAllocation> byJudgmentId(
        List<LimitAllocation> allocations
    ) {
        Map<UUID, LimitAllocation> result = new HashMap<>();
        for (LimitAllocation allocation : allocations) {
            if (result.put(allocation.judgmentId(), allocation) != null) {
                throw new IllegalArgumentException(
                    "Duplicate judgment allocation: " + allocation.judgmentId()
                );
            }
        }
        return result;
    }
}
