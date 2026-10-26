package com.ktc4.pusan4.merchant.classify;

/**
 * 분류 결과 한 건.
 *
 * @param merchantNorm     정규화 키({@code T1Result.normKey}). B4 가 거래의 {@code merchant_norm} 에 저장하고,
 *                         B8 이 같은 값을 개인 사전의 {@code pattern} 으로 쓴다
 * @param merchantCategory 카테고리. 실패하면 {@link #UNCLASSIFIED}
 * @param stage            분류가 끝난 단계
 * @param matchedRule      KEYWORD 면 걸린 패턴, PG 면 PG 토큰, 그 외 {@code null}
 * @param hint             되묻기 화면 힌트. uncertain 룰의 힌트 또는 PG 뒤에 남은 토큰. 없으면 빈 문자열
 */
public record ClassificationResult(
        String merchantNorm,
        String merchantCategory,
        ClassificationStage stage,
        String matchedRule,
        String hint
) {
    /** 분류 실패 센티넬(api.md 2.12). {@code categories.yaml} 에 없는 값이다. */
    public static final String UNCLASSIFIED = "미분류";

    static ClassificationResult unclassified(String merchantNorm, String hint) {
        return new ClassificationResult(merchantNorm, UNCLASSIFIED, ClassificationStage.UNCLASSIFIED, null, hint);
    }

    public boolean classified() {
        return stage != ClassificationStage.UNCLASSIFIED;
    }
}
