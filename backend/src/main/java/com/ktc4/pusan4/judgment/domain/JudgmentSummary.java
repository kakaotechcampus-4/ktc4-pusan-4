package com.ktc4.pusan4.judgment.domain;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * 판정 결과 집계 (api.md 3.7 summary).
 * awaiting 은 답변 대기(불가인데 답하지 않은 질문이 걸린 거래)다. 판정이 아니라 불가에 붙는 표지라 byVerdict 의 불가에도 들어 있다.
 * overridden 은 사용자가 직접 바꾼 판정을 바뀐 판정별로 센다. byVerdict 에도 들어 있다.
 * byYear 는 해마다(거래 승인일) 가능 판정의 경비 가능 금액이다. 신고는 해마다 따로 해서 두 해에 걸친 업로드를 나눠 보인다.
 */
public record JudgmentSummary(int totalCount, Map<Verdict, Total> byVerdict, List<AccountTotal> byAccount,
                              Total awaiting, Map<Verdict, Total> overridden, List<YearTotal> byYear) {

    /**
     * 집계할 판정 하나. finalAmount 는 금액 계산 전이면 비어 있다. spendAmount 는 거래의 결제 금액, year 는 거래 승인일의 해다.
     */
    public record Row(Verdict verdict, String account, Long finalAmount, long spendAmount, boolean awaiting,
                      int year, boolean overridden) {
    }

    /** spendAmount 는 결제 금액 합이다. 경비 가능 금액과 견주어 보이는 바탕이다. */
    public record Total(int count, long finalAmount, long spendAmount) {
    }

    public record AccountTotal(String account, int count, long finalAmount) {
    }

    /** 그해 가능 판정의 경비 가능 금액 합. */
    public record YearTotal(int year, long finalAmount) {
    }

    /** verdict 는 판정이 없어도 셋 다 0 으로 넣는다. */
    public static JudgmentSummary of(List<Row> rows) {
        return new JudgmentSummary(rows.size(), byVerdict(rows, row -> true), byAccount(rows),
            total(rows.stream().filter(Row::awaiting).toList()), byVerdict(rows, Row::overridden), byYear(rows));
    }

    private static Map<Verdict, Total> byVerdict(List<Row> rows, Predicate<Row> included) {
        Map<Verdict, Total> byVerdict = new EnumMap<>(Verdict.class);
        for (Verdict verdict : Verdict.values()) {
            byVerdict.put(verdict, total(rows.stream()
                .filter(included)
                .filter(row -> row.verdict() == verdict)
                .toList()));
        }
        return byVerdict;
    }

    private static Total total(List<Row> rows) {
        return new Total(rows.size(), sumAmount(rows), rows.stream().mapToLong(Row::spendAmount).sum());
    }

    /** 판정이 있는 해마다 하나, 해 순이다. 가능 판정이 없는 해는 0 이다. */
    private static List<YearTotal> byYear(List<Row> rows) {
        Map<Integer, List<Row>> byYear = rows.stream().collect(Collectors.groupingBy(Row::year, TreeMap::new,
            Collectors.toList()));
        return byYear.entrySet().stream()
            .map(year -> new YearTotal(year.getKey(), sumAmount(year.getValue().stream()
                .filter(row -> row.verdict() == Verdict.AVAILABLE)
                .toList())))
            .toList();
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
