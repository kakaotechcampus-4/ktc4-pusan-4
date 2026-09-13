package com.ktc4.pusan4.judgment.limit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AnnualFinalizationPolicyTest {

    @Test
    void requires_revenue_confirmation_and_no_pending_work() {
        FinalizationDecision decision = AnnualFinalizationPolicy.evaluate(
            new FinalizationConditions(false, 2, 1)
        );

        assertThat(decision.ready()).isFalse();
        assertThat(decision.reasons()).containsExactly(
            FinalizationBlocker.CURRENT_YEAR_REVENUE_UNCONFIRMED,
            FinalizationBlocker.UNRESOLVED_QUESTIONS,
            FinalizationBlocker.REVIEW_PENDING
        );
    }

    @Test
    void allows_finalization_when_all_conditions_are_resolved() {
        assertThat(AnnualFinalizationPolicy.evaluate(
            new FinalizationConditions(true, 0, 0)
        ).ready()).isTrue();
    }
}
