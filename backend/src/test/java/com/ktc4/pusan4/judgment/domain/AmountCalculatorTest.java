package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AmountCalculatorTest {

    private static final UserContext NO_RATIO = new UserContext("940909", false, null);

    @Test
    void only_available_judgments_have_an_amount() {
        TransactionInput cafe = transaction(LocalDate.of(2025, 3, 14), 20_000);

        assertThat(AmountCalculator.finalAmount(judgment(Verdict.UNAVAILABLE, Map.of()), cafe, NO_RATIO)).isZero();
        assertThat(AmountCalculator.finalAmount(judgment(Verdict.NEEDS_REVIEW, Map.of()), cafe, NO_RATIO)).isZero();
        assertThat(AmountCalculator.finalAmount(judgment(Verdict.AVAILABLE, Map.of()), cafe, NO_RATIO))
            .isEqualTo(20_000);
    }

    @Test
    void home_office_apportionment_uses_the_context_ratio_and_drops_fractions() {
        Judgment homeOffice = judgment(Verdict.AVAILABLE, Map.of("안분", "작업공간비율"));

        assertThat(AmountCalculator.finalAmount(homeOffice, transaction(LocalDate.of(2025, 2, 25), 80_000),
            new UserContext("940909", false, 20))).isEqualTo(16_000);
        // 33,333 × 15% = 4,999.95 → 4,999
        assertThat(AmountCalculator.finalAmount(homeOffice, transaction(LocalDate.of(2025, 2, 25), 33_333),
            new UserContext("940909", false, 15))).isEqualTo(4_999);
        // 엔진은 비율이 없으면 확인필요로 둔다. 사용자가 가능으로 수정했으면 전액이다
        assertThat(AmountCalculator.finalAmount(homeOffice, transaction(LocalDate.of(2025, 2, 25), 80_000), NO_RATIO))
            .isEqualTo(80_000);
    }

    @Test
    void immediate_expensing_keeps_the_full_amount() {
        Judgment macbook = judgment(Verdict.AVAILABLE, Map.of("즉시상각_가능", true));

        assertThat(AmountCalculator.finalAmount(macbook, transaction(LocalDate.of(2025, 3, 14), 3_500_000), NO_RATIO))
            .isEqualTo(3_500_000);
    }

    @Test
    void asset_expenses_only_this_years_depreciation_from_the_acquisition_month() {
        Judgment declining = judgment(Verdict.AVAILABLE, Map.of("자산", true, "상각방법", "정률법", "내용연수", 5));
        Judgment straight = judgment(Verdict.AVAILABLE, Map.of("자산", true, "상각방법", "정액법", "내용연수", 5));

        // 3월 3일 취득: 3~12월 10개월. 1,000,001 × 0.451 × 10/12 = 375,833.7 → 375,833
        assertThat(AmountCalculator.finalAmount(declining, transaction(LocalDate.of(2025, 3, 3), 1_000_001), NO_RATIO))
            .isEqualTo(375_833);
        // 12월 31일 취득도 1개월로 센다. 1,200,000 × 0.2 × 1/12 = 20,000
        assertThat(AmountCalculator.finalAmount(straight, transaction(LocalDate.of(2025, 12, 31), 1_200_000), NO_RATIO))
            .isEqualTo(20_000);
    }

    @Test
    void asset_without_a_known_rate_is_a_card_error() {
        Judgment unknownLife = judgment(Verdict.AVAILABLE, Map.of("자산", true, "상각방법", "정률법", "내용연수", 8));
        Judgment noMethod = judgment(Verdict.AVAILABLE, Map.of("자산", true, "내용연수", 5));
        TransactionInput purchase = transaction(LocalDate.of(2025, 3, 3), 2_000_000);

        assertThatThrownBy(() -> AmountCalculator.finalAmount(unknownLife, purchase, NO_RATIO))
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> AmountCalculator.finalAmount(noMethod, purchase, NO_RATIO))
            .isInstanceOf(IllegalStateException.class);
    }

    private static TransactionInput transaction(LocalDate approvedAt, long amount) {
        return new TransactionInput(UUID.randomUUID(), approvedAt, "가맹점", "사무용품", amount);
    }

    private static Judgment judgment(Verdict verdict, Map<String, Object> attributes) {
        return new Judgment(verdict, null, false, null, "소모품비", List.of("R-000"), List.of(), attributes, List.of());
    }
}
