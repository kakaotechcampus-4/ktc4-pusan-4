package com.ktc4.pusan4.merchant.classify;

/**
 * 키워드룰 한 개가 이긴 결과.
 *
 * @param category 룰의 카테고리. {@link KeywordRules#UNCERTAIN} 이면 분류가 아니라 힌트다
 * @param pattern  걸린 룰의 {@code match} 원문
 * @param hint     룰의 {@code hint}. 없으면 빈 문자열
 */
public record KeywordMatch(String category, String pattern, String hint) {

    /** {@code category: uncertain} 룰. 분류를 확정하지 않고 되묻기 힌트만 남긴다. */
    public boolean uncertain() {
        return KeywordRules.UNCERTAIN.equals(category);
    }
}
