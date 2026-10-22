package com.ktc4.pusan4.judgment.domain;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 판정 결과 집계 (api.md 3.7 summary).
 */
public record JudgmentSummary(int totalCount, Map<Verdict, Total> byVerdict, List<AccountTotal> byAccount) {

    /** 집계할 판정 하나. finalAmount 는 금액 계산 전이면 비어 있다. */
    public record Row(Verdict verdict, String account, Long finalAmount) {
    }

    public record Total(int count, long finalAmount) {
    }

    public record AccountTotal(String account, int count, long finalAmount) {
    }

    /** verdict 는 판정이 없어도 셋 다 0 으로 넣는다. */
    public static JudgmentSummary of(List<Row> rows) {
        Map<Verdict, Total> byVerdict = new EnumMap<>(Verdict.class);
        for (Verdict verdict : Verdict.values()) {
            List<Row> matched = rows.stream().filter(row -> row.verdict() == verdict).toList();
            byVerdict.put(verdict, new Total(matched.size(), sumAmount(matched)));
        }
        return new JudgmentSummary(rows.size(), byVerdict, byAccount(rows));
    }

    /** 인정된(AVAILABLE) 비용만 계정별로 모은다. 금액이 같으면 계정 이름순이다. */
    private static List<AccountTotal> byAccount(List<Row> rows) {
        Map<String, List<Row>> byAccount = rows.stream()
            .filter(row -> row.verdict() == Verdict.AVAILABLE && row.account() != null)
            .collect(Collectors.groupingBy(Row::account));
        return byAccount.entrySet().stream()
            .map(entry -> new AccountTotal(entry.getKey(), entry.getValue().size(), sumAmount(entry.getValue())))
            .sorted(Comparator.comparingLong(AccountTotal::finalAmount).reversed()
                .thenComparing(AccountTotal::account))
            .toList();
    }

    private static long sumAmount(List<Row> rows) {
        return rows.stream().mapToLong(row -> row.finalAmount() == null ? 0L : row.finalAmount()).sum();
    }
}
