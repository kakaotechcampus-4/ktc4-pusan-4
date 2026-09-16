package com.ktc4.pusan4.judgment.limit;

import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

public record LimitCandidate(UUID judgmentId, LocalDate approvedAt, long taggedAmount) {
    public LimitCandidate {
        Objects.requireNonNull(judgmentId, "judgmentId");
        Objects.requireNonNull(approvedAt, "approvedAt");
        if (taggedAmount < 0) {
            throw new IllegalArgumentException("taggedAmount must not be negative");
        }
    }
}
