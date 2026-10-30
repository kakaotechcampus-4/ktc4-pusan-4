package com.ktc4.pusan4.transaction.domain;

/**
 * 분류 응답 결과 (api.md 3.5).
 *
 * @param judgedCount batch 에 완료된 판정 실행이 없으면 0. 있으면 다시 판정한 거래 수
 */
public record ClassificationAnswer(int resolvedCount, String merchantCategory, int judgedCount) {
}
