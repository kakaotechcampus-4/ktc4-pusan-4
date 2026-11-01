package com.ktc4.pusan4.judgment.limit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EntertainmentLimitTest {

    @Test
    void annual_limit_is_the_basic_limit_plus_the_revenue_limit() {
        // 1,200만원 × 12/12 + 3,000만원 × 30/10,000
        assertThat(EntertainmentLimit.annual(30_000_000L)).isEqualTo(12_090_000L);
        assertThat(EntertainmentLimit.annual(0L)).isEqualTo(12_000_000L);
    }

    @Test
    void revenue_limit_follows_the_tiers_and_drops_fractions() {
        assertThat(EntertainmentLimit.revenueLimit(10_000_000_000L)).isEqualTo(30_000_000L);
        // 3,000만원 + 100억원 × 20/10,000
        assertThat(EntertainmentLimit.revenueLimit(20_000_000_000L)).isEqualTo(50_000_000L);
        assertThat(EntertainmentLimit.revenueLimit(50_000_000_000L)).isEqualTo(110_000_000L);
        // 1억1천만원 + 100억원 × 3/10,000
        assertThat(EntertainmentLimit.revenueLimit(60_000_000_000L)).isEqualTo(113_000_000L);
        // 333 × 30/10,000 = 0.999 → 0
        assertThat(EntertainmentLimit.revenueLimit(333L)).isZero();
    }
}
