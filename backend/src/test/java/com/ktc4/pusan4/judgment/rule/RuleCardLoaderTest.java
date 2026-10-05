package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.Citation;
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
        Files.writeString(root.resolve("cards/R-020.yaml"), cardYaml("R-020", 450));
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
    void rejects_priority_below_401() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-010.yaml"), cardYaml("R-010", 400));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-010")
            .hasMessageContaining("priority");
    }

    @Test
    void loads_question_option_effects() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-027.yaml"), """
            id: R-027
            version: 1
            gate: G3
            priority: 401
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
    void loads_option_citations_as_citations_not_attributes() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-027.yaml"), """
            id: R-027
            version: 1
            gate: G3
            priority: 401
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            question:
              code: PURPOSE
              text: 이 결제는 어떤 용도였나요?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 업무미팅, verdict: 가능, citations: [{ id: 소득세법-35-1, verified: true }] }
                - { value: 개인, verdict: 불가 }
            citations: [소득세법-33-1-5]
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        RuleCard card = new RuleCardLoader().load(root).get(Gate.G3).getFirst();

        assertThat(card.questions().getFirst().effects()).containsEntry(
            "업무미팅",
            new QuestionEffect(Verdict.AVAILABLE, null, Map.of(), List.of(new Citation("소득세법-35-1")))
        );
    }

    // 카드 근거가 없어도 확정 답마다 자기 근거가 있으면 된다. 근거 없는 확정 답이 하나라도 있으면 거부한다.
    @Test
    void rejects_final_option_verdict_without_card_or_option_citation() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-027.yaml"), """
            id: R-027
            version: 1
            gate: G3
            priority: 401
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            question:
              code: PURPOSE
              text: 이 결제는 어떤 용도였나요?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 업무미팅, verdict: 가능, citations: [소득세법-35-1] }
                - { value: 개인, verdict: 불가 }
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-027")
            .hasMessageContaining("effect verdict requires citation");
    }

    @Test
    void accepts_final_option_verdicts_that_each_carry_their_own_citation() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-027.yaml"), """
            id: R-027
            version: 1
            gate: G3
            priority: 401
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            question:
              code: PURPOSE
              text: 이 결제는 어떤 용도였나요?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 업무미팅, verdict: 가능, citations: [소득세법-35-1] }
                - { value: 개인, verdict: 불가, citations: [소득세법-33-1-5] }
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        RuleCard card = new RuleCardLoader().load(root).get(Gate.G3).getFirst();

        assertThat(card.citations()).isEmpty();
    }

    @Test
    void loads_g4_asset_card_from_test_resource() throws Exception {
        Path rulesDirectory = Path.of(getClass().getResource("/cards").toURI()).getParent();

        RuleCard card = new RuleCardLoader().load(rulesDirectory).get(Gate.G4).stream()
            .filter(loaded -> loaded.id().equals("R-051"))
            .findFirst()
            .orElseThrow();

        assertThat(card.match().amountMin()).isEqualTo(1_000_001L);
        assertThat(card.match().excludedCategories()).containsExactly("카페", "음식점", "음식배달");
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
    void rejects_out_of_scope_card_that_already_decided() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-080.yaml"), """
            id: R-080
            version: 1
            gate: G2
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            verdict: 불가
            out_of_scope: true
            citations:
              - { id: 소득세법-33-1-5, verified: true }
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("out_of_scope");
    }

    // 오타가 false 로 조용히 떨어지면 핸드오프가 사라지고 확인필요로만 보인다.
    @Test
    void rejects_non_boolean_out_of_scope() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-081.yaml"), """
            id: R-081
            version: 1
            gate: G2
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [카페]
            verdict: 확인필요
            out_of_scope: "ture"
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("boolean");
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

    @Test
    void rejects_category_outside_vocabulary_when_categories_file_present() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("categories.yaml"), """
            categories:
              - 카페
              - 음식점
            """);
        Files.writeString(root.resolve("cards/R-051.yaml"), """
            id: R-051
            version: 1
            gate: G4
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              amount_min: 1000001
              exclude_category: [소모품]
            attributes:
              자산: true
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("소모품");
    }

    @Test
    void accepts_categories_within_vocabulary_when_categories_file_present() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("categories.yaml"), """
            categories:
              - 카페
              - 음식점
            """);
        Files.writeString(root.resolve("cards/R-051.yaml"), """
            id: R-051
            version: 1
            gate: G4
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              amount_min: 1000001
              exclude_category: [카페, 음식점]
            attributes:
              자산: true
            review: { by: 외부자문, date: 2026-09-05 }
            """);

        List<RuleCard> cards = new RuleCardLoader().load(root).get(Gate.G4);

        assertThat(cards).extracting(RuleCard::id).containsExactly("R-051");
    }

    @Test
    void loads_holiday_match_flag() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("true", ""));

        RuleCard card = new RuleCardLoader().load(root).get(Gate.G5).getFirst();

        assertThat(card.match().holiday()).isTrue();
    }

    // 휴일은 조문이 아니라 추정의 근거다. 휴일 카드가 낼 수 있는 판정은 소명으로 풀리는 불가뿐이다.
    @Test
    void loads_holiday_unavailable_with_rebuttal_question() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("true", """
            verdict: 불가
            citations: [소득세법-33-1-5]
            question:
              text: 거래처 미팅이었나요?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 업무미팅, verdict: 확인필요 }
                - { value: 개인, verdict: 불가 }
            """));

        RuleCard card = new RuleCardLoader().load(root).get(Gate.G5).getFirst();

        assertThat(card.verdict()).isEqualTo(Verdict.UNAVAILABLE);
    }

    // 소명할 길이 없는 휴일 불가는 "주말 = 무조건 불가"다.
    @Test
    void rejects_holiday_unavailable_without_question() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("true", """
            verdict: 불가
            citations: [소득세법-33-1-5]
            """));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("holiday");
    }

    @Test
    void rejects_holiday_unavailable_whose_options_cannot_lift_it() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("true", """
            verdict: 불가
            citations: [소득세법-33-1-5]
            question:
              text: 어떤 용도였나요?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 개인, verdict: 불가 }
                - { value: 모르겠음 }
            """));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("holiday");
    }

    @Test
    void rejects_holiday_card_with_verdict() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("true", """
            verdict: 확인필요
            """));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("holiday");
    }

    @Test
    void rejects_holiday_card_with_option_verdict() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("true", """
            citations: [소득세법-33-1-5]
            question:
              text: 주말 결제입니다. 어떤 용도였나요?
              fact_type: 용도
              group_by: transaction
              options:
                - { value: 개인, verdict: 불가 }
            """));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("holiday");
    }

    // 문자열 "true" 가 조용히 false 로 떨어지면 휴일 조건이 사라져 모든 날에 카드가 붙는다.
    @Test
    void rejects_non_boolean_holiday() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"), holidayCardYaml("\"true\"", ""));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-061")
            .hasMessageContaining("holiday must be a boolean");
    }

    // weekday 는 holiday 로 대체됐다. 남아 있으면 조용히 무시되어 요일 조건이 사라진다.
    @Test
    void rejects_removed_weekday_match_key() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-061.yaml"),
            holidayCardYaml("true", "").replace("  holiday: true\n", "  weekday: [토, 일]\n"));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-061")
            .hasMessageContaining("weekday");
    }

    private static String holidayCardYaml(String holiday, String extra) {
        return """
            id: R-061
            version: 1
            gate: G5
            priority: 500
            effective_period: { start: 2025-01-01, end: null }
            match:
              category: [음식점]
              holiday: %s
            review: { by: 외부자문, date: 2026-09-26 }
            """.formatted(holiday) + extra;
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
