package com.ktc4.pusan4.judgment.persistence;

import java.util.UUID;

/**
 * 질문 응답 결과 (api.md 3.10).
 *
 * @param answeredCount            함께 처리한 형제 질문까지 센 수
 * @param rejudgedTransactionCount 다시 판정한 거래 수
 */
public record QuestionAnswerResult(int answeredCount, UUID factId, int rejudgedTransactionCount) {
}
