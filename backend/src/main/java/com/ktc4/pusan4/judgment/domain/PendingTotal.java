package com.ktc4.pusan4.judgment.domain;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 미해소 집계 (api.md 3.9). PENDING 질문 수와 그 질문이 걸린 거래 금액 합계.
 */
public record PendingTotal(int count, long amount) {

    /** 한 거래에 대기 질문이 여럿이어도 금액은 한 번만 더한다. */
    public static PendingTotal of(List<Question> questions) {
        List<Question> pending = questions.stream()
            .filter(question -> question.status() == QuestionStatus.PENDING)
            .toList();
        Map<UUID, Long> amounts = pending.stream()
            .collect(Collectors.toMap(Question::transactionId, question -> question.transaction().amount(),
                (first, second) -> first));
        return new PendingTotal(pending.size(), amounts.values().stream().mapToLong(Long::longValue).sum());
    }
}
