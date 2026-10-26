package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static com.ktc4.pusan4.judgment.domain.QuestionFixtures.question;
import static com.ktc4.pusan4.judgment.domain.QuestionFixtures.uuid;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class QuestionGroupTest {

    @Test
    void groups_by_group_key_fact_type_and_status() {
        // given: 같은 가맹점의 대기 질문 둘(거래일 역순), 답한 질문 하나, 다른 factType 하나
        Question later = question(1, uuid(102), LocalDate.parse("2025-10-20"), 3_000L, QuestionStatus.PENDING);
        Question earlier = question(2, uuid(101), LocalDate.parse("2025-10-01"), 10_000L, QuestionStatus.PENDING);
        Question answered = question(3, uuid(103), 7_000L, QuestionStatus.ANSWERED);
        Question proof = withFactType(question(4, uuid(101), 10_000L, QuestionStatus.PENDING), "증빙유무");

        // when
        List<QuestionGroup> groups = QuestionGroup.group(List.of(later, earlier, answered, proof));

        // then: 상태·factType 이 다르면 다른 그룹이고, 그룹 안 거래는 거래일 순이다
        assertThat(groups).extracting(QuestionGroup::status, QuestionGroup::factType, QuestionGroup::questionIds)
            .containsExactly(
                tuple(QuestionStatus.PENDING, "용도", List.of(earlier.id(), later.id())),
                tuple(QuestionStatus.PENDING, "증빙유무", List.of(proof.id())),
                tuple(QuestionStatus.ANSWERED, "용도", List.of(answered.id()))
            );
        assertThat(groups.getFirst().count()).isEqualTo(2);
        assertThat(groups.getFirst().totalAmount()).isEqualTo(13_000L);
    }

    @Test
    void orders_groups_by_count_then_total_amount_then_first_question_id() {
        // given: 두 건이지만 금액이 작은 그룹, 금액이 큰 한 건 그룹, 금액이 같은 한 건 그룹 둘
        Question pairFirst = withGroupKey(question(2, uuid(102), 1_000L, QuestionStatus.PENDING), "merchant:b");
        Question pairSecond = withGroupKey(question(3, uuid(103), 1_000L, QuestionStatus.PENDING), "merchant:b");
        Question large = withGroupKey(question(6, uuid(106), 9_000L, QuestionStatus.PENDING), "merchant:e");
        Question tieEarlier = withGroupKey(question(1, uuid(101), 5_000L, QuestionStatus.PENDING), "merchant:a");
        Question tieLater = withGroupKey(question(5, uuid(105), 5_000L, QuestionStatus.PENDING), "merchant:c");

        // when
        List<QuestionGroup> groups = QuestionGroup.group(List.of(tieLater, large, pairSecond, tieEarlier, pairFirst));

        // then: 건수가 많은 순, 같으면 금액이 큰 순, 그다음 그룹 첫 질문 id 순 (#54)
        assertThat(groups).extracting(QuestionGroup::groupKey)
            .containsExactly("merchant:b", "merchant:e", "merchant:a", "merchant:c");
    }

    @Test
    void bulk_answerable_only_when_pending_and_no_transaction_awaits_explanation() {
        // given: 같은 그룹이 될 대기 질문 둘 중 하나가 소명 대기 거래의 질문이다
        Question normal = question(1, uuid(101), 10_000L, QuestionStatus.PENDING);
        Question awaiting = awaitingExplanation(question(2, uuid(102), 3_000L, QuestionStatus.PENDING));

        // when / then
        assertThat(QuestionGroup.group(List.of(normal)).getFirst().bulkAnswerable()).isTrue();
        assertThat(QuestionGroup.group(List.of(normal, awaiting)).getFirst().bulkAnswerable()).isFalse();
        assertThat(QuestionGroup.group(List.of(question(3, uuid(103), 1_000L, QuestionStatus.ANSWERED)))
            .getFirst().bulkAnswerable()).isFalse();
    }

    @Test
    void answered_group_shares_the_answer_and_pending_group_has_none() {
        // when
        QuestionGroup answered = QuestionGroup.group(List.of(question(1, uuid(101), 1_000L, QuestionStatus.ANSWERED)))
            .getFirst();
        QuestionGroup pending = QuestionGroup.group(List.of(question(2, uuid(102), 1_000L, QuestionStatus.PENDING)))
            .getFirst();

        // then
        assertThat(answered.answer()).isEqualTo("사업");
        assertThat(pending.answer()).isNull();
    }

    private static Question awaitingExplanation(Question question) {
        return new Question(question.id(), question.batchId(), question.transactionId(), question.groupKey(),
            question.factType(), question.questionText(), question.options(), question.status(),
            question.answeredFactId(), question.answer(), question.createdAt(), question.answeredAt(),
            question.transaction(), question.overridden(), true);
    }

    private static Question withGroupKey(Question question, String groupKey) {
        return new Question(question.id(), question.batchId(), question.transactionId(), groupKey,
            question.factType(), question.questionText(), question.options(), question.status(),
            question.answeredFactId(), question.answer(), question.createdAt(), question.answeredAt(),
            question.transaction(), question.overridden(), question.awaitingExplanation());
    }

    private static Question withFactType(Question question, String factType) {
        return new Question(question.id(), question.batchId(), question.transactionId(), question.groupKey(), factType,
            question.questionText(), question.options(), question.status(), question.answeredFactId(),
            question.answer(), question.createdAt(), question.answeredAt(), question.transaction(),
            question.overridden(), question.awaitingExplanation());
    }
}
