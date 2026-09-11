package com.ktc4.pusan4.judgment.limit;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class AnnualLimitAllocator {

    private static final Comparator<LimitCandidate> ALLOCATION_ORDER = Comparator
        .comparing(LimitCandidate::approvedAt)
        .thenComparing(LimitCandidate::judgmentId);

    private AnnualLimitAllocator() {
    }

    public static List<LimitAllocation> allocate(
        long annualLimit,
        List<LimitCandidate> candidates
    ) {
        if (annualLimit < 0) {
            throw new IllegalArgumentException("annualLimit must not be negative");
        }
        long remaining = annualLimit;
        List<LimitAllocation> result = new ArrayList<>();
        for (LimitCandidate candidate : candidates.stream().sorted(ALLOCATION_ORDER).toList()) {
            long allowedAmount = Math.min(candidate.taggedAmount(), remaining);
            result.add(new LimitAllocation(
                candidate.judgmentId(), candidate.taggedAmount(), allowedAmount
            ));
            remaining -= allowedAmount;
        }
        return List.copyOf(result);
    }
}
