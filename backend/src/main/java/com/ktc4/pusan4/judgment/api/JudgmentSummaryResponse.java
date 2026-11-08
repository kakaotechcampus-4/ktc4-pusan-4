package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.domain.LimitYearTotal;
import com.ktc4.pusan4.judgment.domain.Verdict;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public record JudgmentSummaryResponse(
    Scope scope,
    int totalCount,
    Map<Verdict, VerdictSummary> byVerdict,
    List<AccountSummary> byAccount,
    @Schema(description = "범위에 접대비 판정이 있는 과세연도마다 한도 합계와 초과액. 과세연도 순. runId 범위는 빈 배열")
    List<LimitYearResponse> limits,
    @Schema(description = "답변 대기(불가인데 답하지 않은 질문이 걸린 거래). 판정이 아니라 불가에 붙는 표지라 byVerdict.UNAVAILABLE 에도 들어 있다")
    AwaitingSummary awaiting
) {

    static JudgmentSummaryResponse from(
        Scope scope, JudgmentSummary summary, List<LimitYearTotal> limits, RuleSet rules
    ) {
        Map<Verdict, VerdictSummary> byVerdict = new EnumMap<>(Verdict.class);
        summary.byVerdict().forEach((verdict, total) ->
            byVerdict.put(verdict, new VerdictSummary(total.count(), total.finalAmount(), total.spendAmount())));
        return new JudgmentSummaryResponse(scope, summary.totalCount(), byVerdict, summary.byAccount().stream()
            .map(account -> new AccountSummary(account.account(), rules.accountLabel(account.account()),
                account.count(), account.finalAmount()))
            .toList(), LimitYearResponse.from(limits, rules),
            new AwaitingSummary(summary.awaiting().count(), summary.awaiting().spendAmount()));
    }

    public record Scope(
        @Schema(description = "BATCH, YEAR, RUN. api.md 예시에는 BATCH 만 있다", example = "BATCH") String type,
        String id
    ) {
    }

    public record VerdictSummary(
        int count,
        long finalAmount,
        @Schema(description = "그 판정이 난 거래의 결제 금액 합") long spendAmount
    ) {
    }

    public record AwaitingSummary(int count, @Schema(description = "답변 대기 거래의 결제 금액 합") long spendAmount) {
    }

    public record AccountSummary(
        @Schema(description = "계정과목 ID", example = "접대비") String account,
        @Schema(description = "계정과목 화면 이름", example = "기업업무추진비") String accountLabel,
        int count,
        long finalAmount
    ) {
    }
}
