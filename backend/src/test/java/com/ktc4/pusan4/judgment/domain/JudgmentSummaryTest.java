package com.ktc4.pusan4.judgment.domain;

import com.ktc4.pusan4.judgment.domain.JudgmentSummary.AccountTotal;
import com.ktc4.pusan4.judgment.domain.JudgmentSummary.Row;
import com.ktc4.pusan4.judgment.domain.JudgmentSummary.Total;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JudgmentSummaryTest {

    @Test
    void by_verdict_counts_every_verdict_and_treats_missing_amount_as_zero() {
        // given: NEEDS_REVIEW 는 하나도 없고, 금액 계산 전 판정이 섞여 있다
        List<Row> rows = List.of(
            new Row(Verdict.AVAILABLE, "소모품비", 10_000L),
            new Row(Verdict.AVAILABLE, "소모품비", null),
            new Row(Verdict.UNAVAILABLE, null, null)
        );

        // when
        JudgmentSummary summary = JudgmentSummary.of(rows);

        // then: 없는 verdict 도 0 으로 나온다
        assertThat(summary.totalCount()).isEqualTo(3);
        assertThat(summary.byVerdict()).isEqualTo(Map.of(
            Verdict.AVAILABLE, new Total(2, 10_000L),
            Verdict.UNAVAILABLE, new Total(1, 0L),
            Verdict.NEEDS_REVIEW, new Total(0, 0L)
        ));
    }

    @Test
    void by_account_sums_available_judgments_by_amount_then_name() {
        // given: 불가·확인 필요의 계정과 계정 없는 가능 판정은 세지 않는다
        List<Row> rows = List.of(
            new Row(Verdict.AVAILABLE, "소모품비", 5_000L),
            new Row(Verdict.AVAILABLE, "지급수수료", 7_000L),
            new Row(Verdict.AVAILABLE, "소모품비", 3_000L),
            new Row(Verdict.AVAILABLE, "도서인쇄비", 8_000L),
            new Row(Verdict.AVAILABLE, null, 9_000L),
            new Row(Verdict.UNAVAILABLE, "접대비", 50_000L),
            new Row(Verdict.NEEDS_REVIEW, "소모품비", 1_000L)
        );

        // when
        JudgmentSummary summary = JudgmentSummary.of(rows);

        // then: 금액 내림차순, 같으면 계정 이름순
        assertThat(summary.byAccount()).containsExactly(
            new AccountTotal("도서인쇄비", 1, 8_000L),
            new AccountTotal("소모품비", 2, 8_000L),
            new AccountTotal("지급수수료", 1, 7_000L)
        );
    }
}
