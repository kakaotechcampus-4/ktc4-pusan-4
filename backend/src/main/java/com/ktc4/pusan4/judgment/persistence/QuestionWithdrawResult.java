package com.ktc4.pusan4.judgment.persistence;

/**
 * 답 취소 결과 (api.md 3.10 답 취소).
 *
 * @param withdrawnCount           ANSWERED 에서 PENDING 으로 돌린 질문 수. 함께 돌린 형제 질문까지 센다
 * @param rejudgedTransactionCount 다시 판정한 거래 수
 */
public record QuestionWithdrawResult(int withdrawnCount, int rejudgedTransactionCount) {
}
