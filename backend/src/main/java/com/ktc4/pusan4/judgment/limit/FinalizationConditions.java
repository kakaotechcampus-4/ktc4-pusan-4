package com.ktc4.pusan4.judgment.limit;

public record FinalizationConditions(
    boolean currentYearRevenueConfirmed,
    int unresolvedQuestionCount,
    int reviewPendingCount
) {
    public FinalizationConditions {
        if (unresolvedQuestionCount < 0 || reviewPendingCount < 0) {
            throw new IllegalArgumentException("pending counts must not be negative");
        }
    }
}
