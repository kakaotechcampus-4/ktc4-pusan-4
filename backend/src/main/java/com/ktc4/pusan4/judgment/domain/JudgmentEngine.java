package com.ktc4.pusan4.judgment.domain;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class JudgmentEngine {

    private static final Comparator<RuleCard> PRIORITY = Comparator
        .comparingInt(RuleCard::priority).reversed()
        .thenComparing(RuleCard::id);

    private static final Comparator<RuleCard> WINNER = Comparator
        .comparingInt(RuleCard::priority).reversed()
        .thenComparing(Comparator.comparingInt(JudgmentEngine::specificity).reversed())
        .thenComparing(RuleCard::id);

    private JudgmentEngine() {
    }

    public static Judgment judge(
        TransactionInput transaction,
        UserContext context,
        List<UserFact> facts,
        List<RuleCard> rules
    ) {
        Judgment blocked = rules.stream()
            .filter(rule -> rule.gate() == Gate.G1)
            .filter(rule -> rule.isEffectiveOn(transaction.approvedAt()))
            .filter(rule -> matches(rule.match(), transaction, context))
            .sorted(PRIORITY)
            .findFirst()
            .map(rule -> new Judgment(
                Verdict.UNAVAILABLE,
                Gate.G1,
                false,
                null,
                rule.account(),
                List.of(rule.id()),
                List.of(rule.version()),
                rule.citations(),
                rule.attributes(),
                rule.questions()
            ))
            .orElse(null);
        if (blocked != null) {
            return blocked;
        }

        RuleCard winner = rules.stream()
            .filter(rule -> rule.gate() == Gate.G2)
            .filter(rule -> rule.isEffectiveOn(transaction.approvedAt()))
            .filter(rule -> matches(rule.match(), transaction, context))
            .sorted(WINNER)
            .findFirst()
            .orElse(null);
        if (winner == null) {
            return new Judgment(
                Verdict.NEEDS_REVIEW, Gate.G2, true, UnmatchedReason.RULE_NOT_FOUND, null,
                List.of(), List.of(), List.of(), java.util.Map.of(), List.of()
            );
        }
        Map<String, Object> attributes = new LinkedHashMap<>(winner.attributes());
        List<QuestionSpec> questions = new ArrayList<>(winner.questions());
        List<String> appliedRuleIds = new ArrayList<>(List.of(winner.id()));
        List<Integer> appliedRuleVersions = new ArrayList<>(List.of(winner.version()));
        LinkedHashSet<Citation> citations = new LinkedHashSet<>(winner.citations());
        Verdict resolvedVerdict = winner.verdict();
        String resolvedAccount = winner.account();

        for (Gate gate : List.of(Gate.G3, Gate.G4, Gate.G5, Gate.G6)) {
            List<RuleCard> matchedRules = rules.stream()
                .filter(rule -> rule.gate() == gate)
                .filter(rule -> rule.isEffectiveOn(transaction.approvedAt()))
                .filter(rule -> matches(rule.match(), transaction, context))
                .sorted(WINNER)
                .toList();
            for (RuleCard rule : matchedRules) {
                mergeAttributes(attributes, rule.attributes(), rule.id());
                for (QuestionSpec question : rule.questions()) {
                    QuestionEffect effect = resolvedEffect(question, transaction, facts);
                    if (effect == null) {
                        questions.add(resolveGroupKey(question, transaction));
                        continue;
                    }
                    mergeAttributes(attributes, effect.attributes(), rule.id() + ":" + question.code());
                    if (effect.verdict() != null) {
                        resolvedVerdict = effect.verdict();
                    }
                    if (effect.account() != null) {
                        resolvedAccount = effect.account();
                    }
                }
                appliedRuleIds.add(rule.id());
                appliedRuleVersions.add(rule.version());
                citations.addAll(rule.citations());
            }
        }

        Verdict verdict = questions.isEmpty() ? resolvedVerdict : Verdict.NEEDS_REVIEW;
        return new Judgment(
            verdict, null, false, null, resolvedAccount, appliedRuleIds, appliedRuleVersions,
            List.copyOf(citations), attributes, questions
        );
    }

    static boolean matches(RuleMatch match, TransactionInput transaction, UserContext context) {
        if (!match.categories().isEmpty()
            && !match.categories().contains(transaction.merchantCategory())) {
            return false;
        }
        if (match.excludedCategories().contains(transaction.merchantCategory())) {
            return false;
        }
        if (!match.keywords().isEmpty()
            && match.keywords().stream().noneMatch(transaction.merchantRaw()::contains)) {
            return false;
        }
        if (match.amountMin() != null && transaction.amount() < match.amountMin()) {
            return false;
        }
        if (match.amountMax() != null && transaction.amount() > match.amountMax()) {
            return false;
        }
        return match.industries().isEmpty() || match.industries().contains(context.industryCode());
    }

    static int specificity(RuleCard card) {
        RuleMatch match = card.match();
        int score = 0;
        if (!match.keywords().isEmpty()) {
            score += 100;
        }
        if (!match.categories().isEmpty()) {
            score += 50;
        }
        if (!match.industries().isEmpty()) {
            score += 30;
        }
        if (match.amountMin() != null || match.amountMax() != null) {
            score += 20;
        }
        return score;
    }

    private static void mergeAttributes(
        Map<String, Object> target,
        Map<String, Object> additions,
        String source
    ) {
        additions.forEach((key, value) -> {
            Object previous = target.putIfAbsent(key, value);
            if (previous != null && !previous.equals(value)) {
                throw new IllegalStateException(
                    "Conflicting attribute '%s' in %s".formatted(key, source)
                );
            }
        });
    }

    private static QuestionEffect resolvedEffect(
        QuestionSpec question,
        TransactionInput transaction,
        List<UserFact> facts
    ) {
        return facts.stream()
            .filter(fact ->
                fact.scopeKey().equals(scopeKey(question.groupBy(), transaction))
                    && fact.factType().equals(question.factType())
            )
            .map(UserFact::selectedValue)
            .map(question::effectFor)
            .filter(java.util.Objects::nonNull)
            .findFirst()
            .orElse(null);
    }

    private static QuestionSpec resolveGroupKey(
        QuestionSpec question,
        TransactionInput transaction
    ) {
        return new QuestionSpec(
            question.code(),
            question.text(),
            question.factType(),
            scopeKey(question.groupBy(), transaction),
            question.options(),
            question.effects()
        );
    }

    private static String scopeKey(String groupBy, TransactionInput transaction) {
        return switch (groupBy) {
            case "transaction" -> "transaction:" + transaction.id();
            case "merchant", "merchant_norm" -> "merchant:" + transaction.merchantNorm();
            default -> groupBy;
        };
    }
}
