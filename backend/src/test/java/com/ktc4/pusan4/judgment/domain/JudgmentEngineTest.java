package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JudgmentEngineTest {

    @Test
    void g1_match_blocks_before_g2() {
        RuleCard g1 = new RuleCard(
            "R-004", 1, Gate.G1, 900,
            RuleMatch.categories("지자체_과태료"),
            Verdict.UNAVAILABLE, null,
            List.of(new Citation("소득세법-33-1-2")),
            Map.of(), List.of()
        );
        RuleCard g2 = new RuleCard(
            "R-027", 1, Gate.G2, 500,
            RuleMatch.categories("지자체_과태료"),
            Verdict.AVAILABLE, "여비교통비",
            List.of(new Citation("소득세법-27-1")),
            Map.of(), List.of()
        );
        TransactionInput transaction = new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14),
            "부산광역시청 주정차위반과태료", "지자체_과태료", 50_000
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(),
            List.of(g2, g1)
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::blockedAtGate,
                Judgment::appliedRuleIds, Judgment::citations)
            .containsExactly(
                Verdict.UNAVAILABLE,
                Gate.G1,
                List.of("R-004"),
                List.of(new Citation("소득세법-33-1-2"))
            );
    }

    @Test
    void g2_uses_priority_then_specificity_then_id() {
        RuleCard generic = new RuleCard(
            "R-030", 1, Gate.G2, 500,
            RuleMatch.categories("카페"),
            Verdict.NEEDS_REVIEW, "접대비",
            List.of(new Citation("소득세법-27-1")),
            Map.of(), List.of()
        );
        RuleCard specific = new RuleCard(
            "R-027", 1, Gate.G2, 500,
            new RuleMatch(
                List.of("카페"), List.of(), List.of("스타벅스"),
                null, 30_000L, List.of()
            ),
            Verdict.AVAILABLE, "소모품비",
            List.of(new Citation("소득세법-27-1")),
            Map.of(), List.of()
        );
        TransactionInput transaction = new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14),
            "스타벅스 부산대점", "카페", 10_000
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(),
            List.of(generic, specific)
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::account, Judgment::appliedRuleIds)
            .containsExactly(Verdict.AVAILABLE, "소모품비", List.of("R-027"));
    }

    @Test
    void attribute_gates_accumulate_without_early_return() {
        RuleCard g2 = card("R-020", Gate.G2, Verdict.AVAILABLE, Map.of(), List.of());
        RuleCard g3 = card("R-030", Gate.G3, null, Map.of("businessRatio", 20), List.of());
        RuleCard g4 = card(
            "R-040", Gate.G4, null, Map.of("assetReview", true),
            List.of(new QuestionSpec("ASSET_TYPE", "무엇을 구입했나요?", "구입품목", "transaction", List.of("컴퓨터", "기타")))
        );
        RuleCard g5 = card("R-050", Gate.G5, null, Map.of("qualifiedEvidence", true), List.of());
        RuleCard g6 = card("R-060", Gate.G6, null, Map.of("limitBucket", "기업업무추진비"), List.of());
        TransactionInput transaction = new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14), "가맹점", "카페", 50_000
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(),
            List.of(g6, g5, g4, g3, g2)
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::attributes,
                judgment -> judgment.questions().stream().map(QuestionSpec::code).toList(),
                Judgment::appliedRuleIds, Judgment::appliedRuleVersions)
            .containsExactly(
                Verdict.NEEDS_REVIEW,
                Map.of(
                    "businessRatio", 20,
                    "assetReview", true,
                    "qualifiedEvidence", true,
                    "limitBucket", "기업업무추진비"
                ),
                List.of("ASSET_TYPE"),
                List.of("R-020", "R-030", "R-040", "R-050", "R-060"),
                List.of(1, 1, 1, 1, 1)
            );
    }

    @Test
    void missing_g2_rule_returns_inference_without_citation() {
        TransactionInput transaction = new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14), "새 가맹점", "기타", 10_000
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(),
            List.of()
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::blockedAtGate,
                Judgment::inference, Judgment::unmatchedReason, Judgment::citations)
            .containsExactly(
                Verdict.NEEDS_REVIEW, Gate.G2, true,
                UnmatchedReason.RULE_NOT_FOUND, List.of()
            );
    }

    @Test
    void ignores_rule_outside_transaction_effective_period() {
        RuleCard expired = new RuleCard(
            "R-004", 1, Gate.G1, 900,
            RuleMatch.categories("지자체_과태료"), Verdict.UNAVAILABLE, null,
            List.of(new Citation("소득세법-33-1-2")), Map.of(), List.of(),
            LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31),
            "외부자문", LocalDate.of(2024, 1, 1)
        );
        TransactionInput transaction = new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14),
            "부산광역시청 주정차위반과태료", "지자체_과태료", 50_000
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(),
            List.of(expired)
        );

        assertThat(result.unmatchedReason()).isEqualTo(UnmatchedReason.RULE_NOT_FOUND);
    }

    @Test
    void matching_user_fact_prevents_repeating_attribute_question() {
        UUID transactionId = UUID.randomUUID();
        RuleCard g2 = card("R-020", Gate.G2, Verdict.AVAILABLE, Map.of(), List.of());
        RuleCard g3 = card(
            "R-027",
            Gate.G3,
            null,
            Map.of(),
            List.of(new QuestionSpec(
                "PURPOSE",
                "이 결제는 어떤 용도였나요?",
                "용도",
                "transaction",
                List.of("업무미팅", "혼자작업", "개인")
            ))
        );
        TransactionInput transaction = new TransactionInput(
            transactionId, LocalDate.of(2025, 3, 14), "스타벅스", "카페", 20_000
        );
        UserFact fact = new UserFact(
            "transaction:" + transactionId,
            "용도",
            Map.of("value", "혼자작업")
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(fact),
            List.of(g3, g2)
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::questions)
            .containsExactly(Verdict.AVAILABLE, List.of());
    }

    @Test
    void matching_user_fact_applies_question_option_effects() {
        UUID transactionId = UUID.randomUUID();
        RuleCard g2 = card("R-020", Gate.G2, Verdict.AVAILABLE, Map.of(), List.of());
        QuestionSpec purposeQuestion = new QuestionSpec(
            "PURPOSE",
            "이 결제는 어떤 용도였나요?",
            "용도",
            "transaction",
            List.of("업무미팅", "개인"),
            Map.of(
                "업무미팅",
                new QuestionEffect(
                    Verdict.AVAILABLE,
                    "접대비",
                    Map.of("limit_bucket", "접대비")
                ),
                "개인",
                new QuestionEffect(Verdict.UNAVAILABLE, null, Map.of())
            )
        );
        RuleCard g3 = card("R-027", Gate.G3, null, Map.of(), List.of(purposeQuestion));
        TransactionInput transaction = new TransactionInput(
            transactionId, LocalDate.of(2025, 3, 14), "스타벅스", "카페", 20_000
        );
        UserFact fact = new UserFact(
            "transaction:" + transactionId,
            "용도",
            Map.of("value", "업무미팅")
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(fact),
            List.of(g3, g2)
        );

        assertThat(result)
            .extracting(
                Judgment::verdict,
                Judgment::account,
                Judgment::attributes,
                Judgment::questions
            )
            .containsExactly(
                Verdict.AVAILABLE,
                "접대비",
                Map.of("limit_bucket", "접대비"),
                List.of()
            );
    }

    @Test
    void merchant_scoped_fact_uses_normalized_merchant_name() {
        RuleCard g2 = card("R-020", Gate.G2, Verdict.AVAILABLE, Map.of(), List.of());
        RuleCard g3 = card(
            "R-027",
            Gate.G3,
            null,
            Map.of(),
            List.of(new QuestionSpec(
                "PURPOSE", "용도는 무엇인가요?", "용도", "merchant_norm", List.of("업무")
            ))
        );
        TransactionInput transaction = new TransactionInput(
            UUID.randomUUID(),
            LocalDate.of(2025, 3, 14),
            "스타벅스 부산대점",
            "스타벅스",
            "카페",
            20_000
        );
        UserFact fact = new UserFact("merchant:스타벅스", "용도", Map.of("value", "업무"));

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(fact),
            List.of(g3, g2)
        );

        assertThat(result.questions()).isEmpty();
    }

    private static RuleCard card(
        String id,
        Gate gate,
        Verdict verdict,
        Map<String, Object> attributes,
        List<QuestionSpec> questions
    ) {
        return new RuleCard(
            id, 1, gate, 500, RuleMatch.categories("카페"), verdict, "접대비",
            List.of(new Citation("근거-" + id)), attributes, questions
        );
    }
}
