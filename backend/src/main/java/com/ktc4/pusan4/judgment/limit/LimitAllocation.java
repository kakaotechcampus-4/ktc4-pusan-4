package com.ktc4.pusan4.judgment.limit;

import java.util.UUID;

public record LimitAllocation(UUID judgmentId, long taggedAmount, long allowedAmount) {
    public LimitAllocation {
        if (taggedAmount < 0 || allowedAmount < 0) {
            throw new IllegalArgumentException("amounts must not be negative");
        }
        if (allowedAmount > taggedAmount) {
            throw new IllegalArgumentException("allowedAmount must not exceed taggedAmount");
        }
    }
}
