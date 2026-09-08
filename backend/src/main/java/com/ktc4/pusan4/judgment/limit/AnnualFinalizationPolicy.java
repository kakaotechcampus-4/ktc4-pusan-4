package com.ktc4.pusan4.judgment.limit;

import java.util.ArrayList;
import java.util.List;

public final class AnnualFinalizationPolicy {

    private AnnualFinalizationPolicy() {
    }

    public static FinalizationDecision evaluate(FinalizationConditions conditions) {
        List<FinalizationBlocker> blockers = new ArrayList<>();
        if (!conditions.currentYearRevenueConfirmed()) {
            blockers.add(FinalizationBlocker.CURRENT_YEAR_REVENUE_UNCONFIRMED);
        }
        if (conditions.unresolvedQuestionCount() > 0) {
            blockers.add(FinalizationBlocker.UNRESOLVED_QUESTIONS);
        }
        if (conditions.reviewPendingCount() > 0) {
            blockers.add(FinalizationBlocker.REVIEW_PENDING);
        }
        return new FinalizationDecision(blockers.isEmpty(), blockers);
    }
}
