package com.ktc4.pusan4.judgment.limit;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AnnualLimitAllocatorTest {

    @Test
    void allocates_oldest_transactions_first_with_id_as_tie_breaker() {
        LimitCandidate later = candidate("00000000-0000-0000-0000-000000000003", "2025-03-01", 500_000);
        LimitCandidate sameDaySecond = candidate("00000000-0000-0000-0000-000000000002", "2025-01-10", 700_000);
        LimitCandidate sameDayFirst = candidate("00000000-0000-0000-0000-000000000001", "2025-01-10", 400_000);

        List<LimitAllocation> result = AnnualLimitAllocator.allocate(
            1_000_000,
            List.of(later, sameDaySecond, sameDayFirst)
        );

        assertThat(result).containsExactly(
            new LimitAllocation(sameDayFirst.judgmentId(), 400_000, 400_000),
            new LimitAllocation(sameDaySecond.judgmentId(), 700_000, 600_000),
            new LimitAllocation(later.judgmentId(), 500_000, 0)
        );
    }

    @Test
    void produces_the_same_result_regardless_of_input_order() {
        LimitCandidate first = candidate("00000000-0000-0000-0000-000000000001", "2025-01-10", 600_000);
        LimitCandidate second = candidate("00000000-0000-0000-0000-000000000002", "2025-02-10", 600_000);

        assertThat(AnnualLimitAllocator.allocate(1_000_000, List.of(first, second)))
            .isEqualTo(AnnualLimitAllocator.allocate(1_000_000, List.of(second, first)));
    }

    private static LimitCandidate candidate(String id, String approvedAt, long amount) {
        return new LimitCandidate(UUID.fromString(id), LocalDate.parse(approvedAt), amount);
    }
}
