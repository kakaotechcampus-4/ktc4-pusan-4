package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.QuestionEffect;
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

        List<RuleCard> cards = new RuleCardLoader().load(root);

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

        RuleCard card = new RuleCardLoader().load(root).getFirst();

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
    void loads_g4_asset_card_with_amount_threshold_and_exclusions() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-051.yaml"), """
            id: R-051
            version: 1
            gate: G4
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              amount_min: 1000001
              exclude_category: [소모품, 식음료, 카페]
            question:
              code: ASSET_OR_EXPENSE
              text: 취득가액이 100만원을 넘습니다. 자산으로 처리할까요?
              fact_type: 자산여부
              group_by: transaction
              options:
                - { value: 자산, 내용연수: 5 }
                - { value: 당기비용, verdict: 가능, account: 소모품비 }
            citations: [소득세법시행령-67-4]
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        RuleCard card = new RuleCardLoader().load(root).getFirst();

        assertThat(card.match().amountMin()).isEqualTo(1_000_001L);
        assertThat(card.match().excludedCategories()).containsExactly("소모품", "식음료", "카페");
        assertThat(card.questions().getFirst())
            .extracting(question -> question.code(), question -> question.factType(),
                question -> question.groupBy())
            .containsExactly("ASSET_OR_EXPENSE", "자산여부", "transaction");
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
