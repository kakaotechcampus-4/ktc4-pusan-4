package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.QuestionEffect;
import com.ktc4.pusan4.judgment.domain.Gate;
import com.ktc4.pusan4.judgment.domain.RuleCard;
import com.ktc4.pusan4.judgment.domain.Verdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RuleCardLoaderTest {

    @TempDir
    Path root;

    @Test
    void loads_only_cards_directory_in_priority_order() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("normalize.yaml"), "not: a-card");
        Files.writeString(root.resolve("cards/R-020.yaml"), cardYaml("R-020", 300));
        Files.writeString(root.resolve("cards/R-010.yaml"), cardYaml("R-010", 900));

        List<RuleCard> cards = new RuleCardLoader().load(root).get(Gate.G1);

        assertThat(cards).extracting(RuleCard::id).containsExactly("R-010", "R-020");
    }

    @Test
    void rejects_equal_blocking_rules_with_same_match() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-010.yaml"), cardYaml("R-010", 500));
        Files.writeString(root.resolve("cards/R-020.yaml"), cardYaml("R-020", 500));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-010")
            .hasMessageContaining("R-020");
    }

    @Test
    void loads_question_option_effects() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-027.yaml"), """
            id: R-027
            version: 1
            gate: G3
            priority: 400
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            question:
              code: PURPOSE
              text: 이 결제는 어떤 용도였나요?
              fact_type: 용도
              group_by: merchant_norm
              options:
                - { value: 업무미팅, verdict: 가능, account: 접대비, limit_bucket: 접대비 }
                - { value: 개인, verdict: 불가 }
            citations: [소득세법-33-1-5]
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        RuleCard card = new RuleCardLoader().load(root).get(Gate.G3).getFirst();

        assertThat(card.questions().getFirst().effects()).containsEntry(
            "업무미팅",
            new QuestionEffect(
                Verdict.AVAILABLE,
                "접대비",
                Map.of("limit_bucket", "접대비")
            )
        );
    }

    @Test
    void loads_g4_asset_card_from_test_resource() throws Exception {
        Path rulesDirectory = Path.of(getClass().getResource("/cards").toURI()).getParent();

        RuleCard card = new RuleCardLoader().load(rulesDirectory).get(Gate.G4).stream()
            .filter(loaded -> loaded.id().equals("R-051"))
            .findFirst()
            .orElseThrow();

        assertThat(card.match().amountMin()).isEqualTo(1_000_001L);
        assertThat(card.match().excludedCategories()).containsExactly("소모품", "식음료", "카페");
        assertThat(card.questions().getFirst())
            .extracting(question -> question.code(), question -> question.factType(),
                question -> question.groupBy())
            .containsExactly("ASSET_OR_EXPENSE", "자산여부", "transaction");
        assertThat(card.questions().getFirst().effects())
            .containsEntry("자산", new QuestionEffect(
                Verdict.NEEDS_REVIEW, null, Map.of("자산", true, "내용연수", 5)))
            .containsEntry("당기비용", new QuestionEffect(
                Verdict.AVAILABLE, "소모품비", Map.of()));
    }

    @Test
    void rejects_scalar_where_match_field_expects_a_list() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-010.yaml"), """
            id: R-010
            version: 1
            gate: G1
            priority: 900
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: 카페
            verdict: 불가
            citations: [소득세법-33-1-2]
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("category");
    }

    @Test
    void rejects_effect_verdict_without_citation() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-027.yaml"), """
            id: R-027
            version: 1
            gate: G2
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            verdict: 확인필요
            question:
              code: PURPOSE
              text: 용도는?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 업무, verdict: 가능, account: 소모품비 }
                - { value: 개인, verdict: 불가 }
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("citation");
    }

    @Test
    void rejects_conflicting_attribute_cards() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-030.yaml"), """
            id: R-030
            version: 1
            gate: G3
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            attributes:
              evidence: 업무목적
            review: { by: 외부자문, date: 2026-09-05 }
            """);
        Files.writeString(root.resolve("cards/R-050.yaml"), """
            id: R-050
            version: 1
            gate: G5
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            attributes:
              evidence: 카드매출전표
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("evidence");
    }

    private static String cardYaml(String id, int priority) {
        return """
            id: %s
            version: 1
            gate: G1
            priority: %d
            effective_period:
              start: 2025-01-01
              end: null
            match:
              category: [지자체_과태료]
            verdict: UNAVAILABLE
            citations: [소득세법-33-1-2]
            review:
              by: 외부자문
              date: 2026-09-05
            """.formatted(id, priority);
    }
}
