package com.ktc4.pusan4.judgment.domain;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 룰엔진 확인 질문 하나 (api.md 3.9).
 *
 * @param answer          답한 값. ANSWERED 가 아니면 null 이다
 * @param transaction     조회 시점의 거래 값
 * @param overridden      거래에 활성 override 가 있는지
 * @param awaitingExplanation 소명 대기 거래의 질문인지 (api.md 3.11 제외 대상)
 */
public record Question(
    UUID id,
    UUID batchId,
    UUID transactionId,
    String groupKey,
    String factType,
    String questionText,
    List<String> options,
    QuestionStatus status,
    UUID answeredFactId,
    String answer,
    OffsetDateTime createdAt,
    OffsetDateTime answeredAt,
    JudgedTransaction transaction,
    boolean overridden,
    boolean awaitingExplanation
) {
}
