package com.ktc4.pusan4.judgment.domain;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 질문 단위 테스트용. 테스트마다 다른 값만 고쳐 쓴다.
 */
final class QuestionFixtures {

    static final UUID BATCH_ID = UUID.fromString("00000000-0000-0000-0000-00000000000b");

    private QuestionFixtures() {
    }

    static Question question(int id, UUID transactionId, long amount, QuestionStatus status) {
        return question(id, transactionId, LocalDate.parse("2025-10-08"), amount, status);
    }

    static Question question(int id, UUID transactionId, LocalDate approvedAt, long amount, QuestionStatus status) {
        return new Question(uuid(id), BATCH_ID, transactionId, "merchant:스타벅스", "용도", "용도가 무엇인가요?",
            List.of("사업", "개인"), status, status == QuestionStatus.ANSWERED ? uuid(900) : null,
            status == QuestionStatus.ANSWERED ? "사업" : null,
            OffsetDateTime.parse("2025-10-09T10:00:00+09:00").plusMinutes(id), null,
            new JudgedTransaction(approvedAt, "스타벅스 서면점", "스타벅스", "카페", amount, 0), false, false, "CAFE_PURPOSE");
    }

    static UUID uuid(int value) {
        return UUID.fromString("00000000-0000-0000-0000-%012d".formatted(value));
    }
}
