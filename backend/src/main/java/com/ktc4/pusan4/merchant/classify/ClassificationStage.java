package com.ktc4.pusan4.merchant.classify;

/**
 * 분류가 어느 단계에서 끝났는지.
 *
 * <p>순서는 {@code PG → PERSONAL_DICT → GLOBAL_DICT → KEYWORD → UNCLASSIFIED} 다.
 * B4 는 {@code UNCLASSIFIED} 로 분류 검토를 만들고, B10 은 {@code UNCLASSIFIED} 만 모아 분류 AI 로 보낸다.
 */
public enum ClassificationStage {
    /** PG 명의라 가맹점을 특정할 수 없다. 카테고리는 {@code PG_미상}, 사전은 보지도 쓰지도 않는다. */
    PG,
    /** 이 사용자의 개인 사전(분류 검토 응답)에 걸렸다. */
    PERSONAL_DICT,
    /** 전역 사전(시드)에 걸렸다. */
    GLOBAL_DICT,
    /** {@code rules/keyword_rules.yaml} 에 걸렸다. */
    KEYWORD,
    /** 어디에도 걸리지 않았다. 카테고리는 {@code 미분류}. */
    UNCLASSIFIED
}
