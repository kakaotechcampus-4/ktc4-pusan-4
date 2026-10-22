package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.domain.Verdict;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public record JudgmentSummaryResponse(
    Scope scope,
    int totalCount,
    Map<Verdict, VerdictSummary> byVerdict,
    List<AccountSummary> byAccount
) {

    static JudgmentSummaryResponse from(Scope scope, JudgmentSummary summary) {
        Map<Verdict, VerdictSummary> byVerdict = new EnumMap<>(Verdict.class);
        summary.byVerdict().forEach((verdict, total) ->
            byVerdict.put(verdict, new VerdictSummary(total.count(), total.finalAmount())));
        return new JudgmentSummaryResponse(scope, summary.totalCount(), byVerdict, summary.byAccount().stream()
            .map(account -> new AccountSummary(account.account(), account.count(), account.finalAmount()))
            .toList());
    }

    public record Scope(
        @Schema(description = "BATCH, YEAR, RUN. api.md 예시에는 BATCH 만 있다", example = "BATCH") String type,
        String id
    ) {
    }

    public record VerdictSummary(int count, long finalAmount) {
    }

    public record AccountSummary(String account, int count, long finalAmount) {
    }
}
