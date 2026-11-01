package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RuleSetTest {

    @Test
    void previous_answer_is_looked_up_by_question_code() {
        RuleSet rules = new RuleSet(List.of(questionCard("R-205", "TELECOM", PreviousAnswer.CARRY)));

        assertThat(rules.previousAnswer("TELECOM")).isEqualTo(PreviousAnswer.CARRY);
        assertThat(rules.previousAnswer("UNKNOWN")).isEqualTo(PreviousAnswer.NONE);
    }

    @Test
    void rejects_one_question_code_with_two_previous_answer_tiers() {
        assertThatThrownBy(() -> new RuleSet(List.of(
            questionCard("R-205", "TELECOM", PreviousAnswer.CARRY),
            questionCard("R-206", "TELECOM", PreviousAnswer.HISTORY))))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("TELECOM");
    }

    private static RuleCard questionCard(String id, String code, PreviousAnswer previousAnswer) {
        QuestionSpec question = new QuestionSpec(code, "질문", "전용여부", "merchant_norm", List.of("전용"), Map.of(),
            previousAnswer);
        return new RuleCard(id, 1, Gate.G2, 500, RuleMatch.categories("통신"), Verdict.NEEDS_REVIEW, null,
            List.of(new Citation("소득세법-33-1-5")), Map.of(), List.of(question));
    }

    @ParameterizedTest
    @EnumSource(Gate.class)
    void preserves_gate_specific_order(Gate gate) {
        RuleSet rules = new RuleSet(List.of(
            card("R-030", gate, 500, RuleMatch.categories("카페")),
            card("R-010", gate, 500, RuleMatch.categories("카페")),
            card("R-020", gate, 500,
                new RuleMatch(List.of("카페"), List.of(), List.of("커피"), null, null, List.of(), false)),
            card("R-040", gate, 900, RuleMatch.categories("카페"))
        ));

        // 모든 관문이 동일하게 priority → specificity → id로 정렬된다(G1도 WINNER 사용).
        assertThat(rules.get(gate)).extracting(RuleCard::id)
            .containsExactly("R-040", "R-020", "R-010", "R-030");
    }

    @Test
    void collects_statutes_cited_by_cards_and_by_answers() {
        QuestionSpec purpose = new QuestionSpec("PURPOSE", "용도는?", "용도", "transaction", List.of("업무미팅", "개인"),
            Map.of("업무미팅", new QuestionEffect(Verdict.AVAILABLE, "접대비", Map.of(), List.of(new Citation("답근거")))));
        RuleSet rules = new RuleSet(List.of(
            new RuleCard("R-300", 1, Gate.G2, 500, RuleMatch.categories("카페"), Verdict.NEEDS_REVIEW, null,
                List.of(new Citation("카드근거")), Map.of(), List.of(purpose)),
            card("R-010", Gate.G1, 500, RuleMatch.categories("카페"))
        ));

        assertThat(rules.statuteIds()).containsExactlyInAnyOrder("카드근거", "답근거", "근거");
    }

    private static RuleCard card(String id, Gate gate, int priority, RuleMatch match) {
        return new RuleCard(
            id, 1, gate, priority, match, Verdict.AVAILABLE, null,
            List.of(new Citation("근거")), Map.of(), List.of()
        );
    }
}
