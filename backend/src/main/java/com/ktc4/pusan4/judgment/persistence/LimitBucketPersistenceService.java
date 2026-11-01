package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.limit.AnnualFinalizationPolicy;
import com.ktc4.pusan4.judgment.limit.FinalizationConditions;
import com.ktc4.pusan4.judgment.limit.FinalizationDecision;
import com.ktc4.pusan4.judgment.limit.LimitAllocation;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LimitBucketPersistenceService {

    private final LimitBucketEntryRepository entryRepository;

    public LimitBucketPersistenceService(LimitBucketEntryRepository entryRepository) {
        this.entryRepository = entryRepository;
    }

    @Transactional
    public void replaceProvisional(
        UUID userId,
        int taxYear,
        String bucketCode,
        List<LimitAllocation> allocations
    ) {
        Map<UUID, LimitAllocation> incoming = byJudgmentId(allocations);
        for (LimitBucketEntryEntity existing : entryRepository.findEntries(userId, taxYear, bucketCode)) {
            LimitAllocation allocation = incoming.remove(existing.judgmentId());
            if (allocation == null) {
                entryRepository.delete(existing);
            } else {
                existing.updateProvisional(allocation);
            }
        }
        incoming.values().forEach(allocation ->
            entryRepository.save(new LimitBucketEntryEntity(
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
        entryRepository.findEntries(userId, taxYear, bucketCode)
            .forEach(LimitBucketEntryEntity::finalizeEntry);
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
