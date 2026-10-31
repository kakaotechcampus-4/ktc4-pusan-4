package com.ktc4.pusan4.judgment.limit;

/**
 * 기업업무추진비(접대비) 연간 한도 (소득세법 §35③, 2026-01-01 시행판).
 * 한도 = 기본한도 + 수입금액별 한도. 원 미만은 버린다.
 */
public final class EntertainmentLimit {

    /** 카드가 붙이는 limit_bucket 값. */
    public static final String BUCKET = "접대비";

    // 조세특례제한법 §6① 중소기업이면 3,600만원이지만, 면세 인적용역사업자(940909)는 조특법상 중소기업이 아니라
    // 1,200만원이다(사전-2025-법규소득-0245).
    // 개인의 과세기간은 1.1~12.31 이라 개월 수는 12 다(소득세법 §5①).
    private static final long BASIC_LIMIT = 12_000_000L;

    private static final long TEN_BILLION = 10_000_000_000L;
    private static final long FIFTY_BILLION = 50_000_000_000L;

    private EntertainmentLimit() {
    }

    public static long annual(long revenue) {
        return BASIC_LIMIT + revenueLimit(revenue);
    }

    /** 특수관계인 수입금액(적용률의 10%)은 문진으로 가를 수 없어 구분하지 않는다. */
    static long revenueLimit(long revenue) {
        if (revenue <= TEN_BILLION) {
            return revenue * 30 / 10_000;
        }
        if (revenue <= FIFTY_BILLION) {
            return 30_000_000L + (revenue - TEN_BILLION) * 20 / 10_000;
        }
        return 110_000_000L + (revenue - FIFTY_BILLION) * 3 / 10_000;
    }
}
