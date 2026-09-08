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
            new RuleSet(List.of(g2, g1))
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
            new RuleSet(List.of(generic, specific))
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
            new RuleSet(List.of(g6, g5, g4, g3, g2))
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
            new RuleSet(List.of())
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
            new RuleSet(List.of(expired))
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
            new RuleSet(List.of(g3, g2))
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
            new RuleSet(List.of(g3, g2))
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
            new RuleSet(List.of(g3, g2))
        );

        assertThat(result.questions()).isEmpty();
    }

    @Test
    void g2_card_question_is_resolved_by_matching_user_fact() {
        UUID transactionId = UUID.randomUUID();
        QuestionSpec purposeQuestion = new QuestionSpec(
            "PURPOSE", "이 결제는 어떤 용도였나요?", "용도", "transaction",
            List.of("업무", "개인"),
            Map.of(
                "업무", new QuestionEffect(Verdict.AVAILABLE, "소모품비", Map.of()),
                "개인", new QuestionEffect(Verdict.UNAVAILABLE, null, Map.of())
            )
        );
        RuleCard g2 = new RuleCard(
            "R-020", 1, Gate.G2, 500, RuleMatch.categories("카페"),
            Verdict.AVAILABLE, null, List.of(new Citation("소득세법-27-1")),
            Map.of(), List.of(purposeQuestion)
        );
        TransactionInput transaction = new TransactionInput(
            transactionId, LocalDate.of(2025, 3, 14), "스타벅스", "카페", 20_000
        );
        UserFact fact = new UserFact(
            "transaction:" + transactionId, "용도", Map.of("value", "업무")
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(fact),
            new RuleSet(List.of(g2))
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::account, Judgment::questions)
            .containsExactly(Verdict.AVAILABLE, "소모품비", List.of());
    }

    @Test
    void later_gate_cannot_relax_an_earlier_unavailable_verdict() {
        UUID transactionId = UUID.randomUUID();
        QuestionSpec purposeQuestion = new QuestionSpec(
            "PURPOSE", "용도는?", "용도", "transaction",
            List.of("업무", "개인"),
            Map.of(
                "업무", new QuestionEffect(Verdict.AVAILABLE, "소모품비", Map.of()),
                "개인", new QuestionEffect(Verdict.UNAVAILABLE, null, Map.of())
            )
        );
        RuleCard g2 = new RuleCard(
            "R-020", 1, Gate.G2, 500, RuleMatch.categories("카페"),
            Verdict.NEEDS_REVIEW, null, List.of(new Citation("소득세법-27-1")),
            Map.of(), List.of(purposeQuestion)
        );
        RuleCard g4 = new RuleCard(
            "R-051", 1, Gate.G4, 500, RuleMatch.categories("카페"),
            null, null, List.of(new Citation("소득세법시행령-67-4")), Map.of(),
            List.of(new QuestionSpec(
                "ASSET_OR_EXPENSE", "자산?", "자산여부", "transaction",
                List.of("자산", "당기비용"),
                Map.of("당기비용", new QuestionEffect(Verdict.AVAILABLE, "소모품비", Map.of()))
            ))
        );
        TransactionInput transaction = new TransactionInput(
            transactionId, LocalDate.of(2025, 3, 14), "스타벅스", "카페", 20_000
        );
        List<UserFact> facts = List.of(
            new UserFact("transaction:" + transactionId, "용도", Map.of("value", "개인")),
            new UserFact("transaction:" + transactionId, "자산여부", Map.of("value", "당기비용"))
        );

        Judgment result = JudgmentEngine.judge(
            transaction, new UserContext("940909", false, null), facts, new RuleSet(List.of(g4, g2))
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::account, Judgment::questions)
            .containsExactly(Verdict.UNAVAILABLE, null, List.of());
    }

    @Test
    void g4_forces_asset_question_above_one_million_for_ambiguous_category() {
        Judgment result = JudgmentEngine.judge(
            subscription("구독", 1_200_000),
            new UserContext("940909", false, null),
            List.of(),
            new RuleSet(List.of(g2Available(), g4AssetCard()))
        );

        assertThat(result)
            .extracting(Judgment::verdict,
                judgment -> judgment.questions().stream().map(QuestionSpec::code).toList())
            .containsExactly(Verdict.NEEDS_REVIEW, List.of("ASSET_OR_EXPENSE"));
    }

    @Test
    void g4_does_not_force_question_below_one_million() {
        Judgment result = JudgmentEngine.judge(
            subscription("구독", 900_000),
            new UserContext("940909", false, null),
            List.of(),
            new RuleSet(List.of(g2Available(), g4AssetCard()))
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::questions)
            .containsExactly(Verdict.AVAILABLE, List.of());
    }

    @Test
    void g4_does_not_force_question_for_excluded_category() {
        Judgment result = JudgmentEngine.judge(
            subscription("카페", 1_200_000),
            new UserContext("940909", false, null),
            List.of(),
            new RuleSet(List.of(g2Available(), g4AssetCard()))
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::questions)
            .containsExactly(Verdict.AVAILABLE, List.of());
    }

    @Test
    void answering_g4_asset_question_resolves_forced_review() {
        TransactionInput transaction = subscription("구독", 1_200_000);
        UserFact fact = new UserFact(
            "transaction:" + transaction.id(), "자산여부", Map.of("value", "당기비용")
        );

        Judgment result = JudgmentEngine.judge(
            transaction,
            new UserContext("940909", false, null),
            List.of(fact),
            new RuleSet(List.of(g2Available(), g4AssetCard()))
        );

        assertThat(result)
            .extracting(Judgment::verdict, Judgment::account, Judgment::questions)
            .containsExactly(Verdict.AVAILABLE, "소모품비", List.of());
    }

    @Test
    void reuses_rules_without_caching_transaction_matches() {
        RuleSet rules = new RuleSet(List.of(g4AssetCard(), g2Available()));
        UserContext context = new UserContext("940909", false, null);

        Judgment large = JudgmentEngine.judge(subscription("구독", 1_200_000), context, List.of(), rules);
        Judgment small = JudgmentEngine.judge(subscription("구독", 900_000), context, List.of(), rules);
        Judgment excluded = JudgmentEngine.judge(subscription("카페", 1_200_000), context, List.of(), rules);

        assertThat(List.of(large.verdict(), small.verdict(), excluded.verdict()))
            .containsExactly(Verdict.NEEDS_REVIEW, Verdict.AVAILABLE, Verdict.AVAILABLE);
    }

    private static TransactionInput subscription(String category, long amount) {
        return new TransactionInput(
            UUID.randomUUID(), LocalDate.of(2025, 3, 14), "가맹점", category, amount
        );
    }

    private static RuleCard g2Available() {
        return new RuleCard(
            "R-020", 1, Gate.G2, 500,
            new RuleMatch(List.of(), List.of(), List.of(), null, null, List.of()),
            Verdict.AVAILABLE, "소모품비",
            List.of(new Citation("소득세법-27-1")),
            Map.of(), List.of()
        );
    }

    private static RuleCard g4AssetCard() {
        QuestionSpec assetQuestion = new QuestionSpec(
            "ASSET_OR_EXPENSE",
            "취득가액이 100만원을 넘습니다. 자산으로 처리할까요?",
            "자산여부",
            "transaction",
            List.of("자산", "당기비용"),
            Map.of(
                "자산", new QuestionEffect(
                    Verdict.NEEDS_REVIEW, null, Map.of("자산", true, "내용연수", 5)
                ),
                "당기비용", new QuestionEffect(Verdict.AVAILABLE, "소모품비", Map.of())
            )
        );
        return new RuleCard(
            "R-051", 1, Gate.G4, 500,
            new RuleMatch(List.of(), List.of("소모품", "식음료", "카페"), List.of(), 1_000_001L, null, List.of()),
            null, null,
            List.of(new Citation("소득세법시행령-67-4")),
            Map.of(), List.of(assetQuestion)
        );
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
