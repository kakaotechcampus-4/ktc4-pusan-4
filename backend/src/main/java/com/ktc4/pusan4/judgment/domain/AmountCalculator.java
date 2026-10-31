package com.ktc4.pusan4.judgment.domain;

import java.util.Map;

/**
 * 거래 한 건의 인정 금액(finalAmount) 최소판 (CONTEXT.md §4 금액 산정, api.md 3.7).
 * 판정 엔진이 남긴 속성을 금액으로 바꾼다. 판정은 바꾸지 않는다.
 *
 * <p>순서는 안분 → 상각이다. 부가세 차감은 현재 페르소나(940909 면세)에서 꺼져 있고, 선급비용 기간배분과
 * G6 한도는 여기서 하지 않는다(한도는 연간 집계라 limit_bucket_entry 에 따로 둔다).
 * 단계마다 원 미만은 버린다.
 */
public final class AmountCalculator {

    // 법인세법 시행규칙 별표 4 상각률(소득세법 시행규칙 §32① 준용), 천분율. 카드가 쓰는 내용연수만 둔다.
    private static final Map<Integer, Map<String, Integer>> RATES_PER_MILLE = Map.of(
        5, Map.of("정액법", 200, "정률법", 451)
    );

    private AmountCalculator() {
    }

    public static long finalAmount(Judgment judgment, TransactionInput transaction, UserContext context) {
        return finalAmount(judgment.verdict(), judgment.attributes(), transaction, context);
    }

    /**
     * 가능이 아니면 0 이다. 불가는 경비가 아니고, 확인필요는 답을 받으면 다시 계산한다.
     * 사용자 수정(override)은 판정의 속성을 이어받아 바뀐 verdict 로 다시 계산한다(api.md 3.8).
     */
    public static long finalAmount(
        Verdict verdict, Map<String, Object> attributes, TransactionInput transaction, UserContext context
    ) {
        if (verdict != Verdict.AVAILABLE) {
            return 0;
        }
        long amount = transaction.amount();
        // 엔진은 비율이 없으면 확인필요로 둔다. 비율 없이 가능인 것은 사용자가 가능으로 수정한 경우라 전액이다.
        if (JudgmentEngine.HOME_OFFICE_RATIO.equals(attributes.get(JudgmentEngine.APPORTIONMENT))
            && context.homeOfficeRatio() != null) {
            amount = amount * context.homeOfficeRatio() / 100;
        }
        if (Boolean.TRUE.equals(attributes.get("자산"))) {
            amount = firstYearDepreciation(amount, transaction.approvedAt().getMonthValue(), attributes);
        }
        return amount;
    }

    /** 상각률 표에 있는 상각방법·내용연수인가. 카드 로더가 자산 선택지를 이것으로 검사한다. */
    public static boolean hasDepreciationRate(Object method, Object life) {
        return depreciationRate(method, life) != null;
    }

    private static Integer depreciationRate(Object method, Object life) {
        return life == null || method == null ? null : RATES_PER_MILLE.getOrDefault(life, Map.of()).get(method);
    }

    /**
     * 취득한 해의 상각범위액. 상각률 × 사업에 쓴 월수 / 12 이고, 1월 미만은 1월로 센다(소득세법 시행령 §62①).
     * 정률법도 첫해는 상각누계액이 없어 취득가액에 상각률을 곱한다.
     * 상각률이 없는 자산 카드는 로드에서 막으므로(RuleCardLoader), 여기 오면 버그다.
     */
    private static long firstYearDepreciation(long cost, int acquiredMonth, Map<String, Object> attributes) {
        Object method = attributes.get("상각방법");
        Object life = attributes.get("내용연수");
        Integer rate = depreciationRate(method, life);
        if (rate == null) {
            throw new IllegalStateException("상각률을 모르는 자산 속성: 상각방법=%s, 내용연수=%s".formatted(method, life));
        }
        int months = 12 - acquiredMonth + 1;
        return cost * rate * months / (1000L * 12);
    }
}
