package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static com.ktc4.pusan4.judgment.domain.QuestionFixtures.question;
import static com.ktc4.pusan4.judgment.domain.QuestionFixtures.uuid;
import static org.assertj.core.api.Assertions.assertThat;

class PendingTotalTest {

    @Test
    void counts_pending_questions_and_sums_each_transaction_once() {
        // given: 한 거래에 대기 질문 둘, 다른 거래에 대기 하나, 답한 질문 하나
        List<Question> questions = List.of(
            question(1, uuid(101), 10_000L, QuestionStatus.PENDING),
            question(2, uuid(101), 10_000L, QuestionStatus.PENDING),
            question(3, uuid(102), 3_000L, QuestionStatus.PENDING),
            question(4, uuid(103), 50_000L, QuestionStatus.ANSWERED)
        );

        // when
        PendingTotal total = PendingTotal.of(questions);

        // then
        assertThat(total).isEqualTo(new PendingTotal(3, 13_000L));
    }
}
