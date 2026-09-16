package com.ktc4.pusan4.judgment.limit;

import java.util.List;

public record FinalizationDecision(boolean ready, List<FinalizationBlocker> reasons) {
    public FinalizationDecision {
        reasons = List.copyOf(reasons);
    }
}
