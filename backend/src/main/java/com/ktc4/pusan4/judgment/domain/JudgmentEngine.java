package com.ktc4.pusan4.judgment.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class JudgmentEngine {

    private JudgmentEngine() {
    }

    public static Judgment judge(
        TransactionInput transaction,
        UserContext context,
        List<UserFact> facts,
        RuleSet rules
    ) {
        Judgment blocked = rules.get(Gate.G1).stream()
            .filter(rule -> rule.isEffectiveOn(transaction.approvedAt()))
            .filter(rule -> matches(rule.match(), transaction, context))
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

        RuleCard winner = rules.get(Gate.G2).stream()
            .filter(rule -> rule.isEffectiveOn(transaction.approvedAt()))
            .filter(rule -> matches(rule.match(), transaction, context))
            .findFirst()
            .orElse(null);
        if (winner == null) {
            return new Judgment(
                Verdict.NEEDS_REVIEW, Gate.G2, true, UnmatchedReason.RULE_NOT_FOUND, null,
                List.of(), List.of(), List.of(), java.util.Map.of(), List.of()
            );
        }
        Map<String, Object> attributes = new LinkedHashMap<>();
        List<QuestionSpec> questions = new ArrayList<>();
        List<String> appliedRuleIds = new ArrayList<>();
        List<Integer> appliedRuleVersions = new ArrayList<>();
        LinkedHashSet<Citation> citations = new LinkedHashSet<>();
        Verdict resolvedVerdict = null;
        String resolvedAccount = null;

        // 승자(G2)와 속성 관문(G3~G6) 카드를 한 파이프라인으로 동일하게 처리한다.
        // 되묻기는 어느 관문에 있든 user_fact로 해소된다.
        List<RuleCard> pipeline = new ArrayList<>();
        pipeline.add(winner);
        for (Gate gate : List.of(Gate.G3, Gate.G4, Gate.G5, Gate.G6)) {
            rules.get(gate).stream()
                .filter(rule -> rule.isEffectiveOn(transaction.approvedAt()))
                .filter(rule -> matches(rule.match(), transaction, context))
                .forEach(pipeline::add);
        }

        for (RuleCard rule : pipeline) {
            mergeAttributes(attributes, rule.attributes(), rule.id());
            // 카드의 기본 판정을, 그 카드의 되묻기 응답(effect)이 있으면 대체한다.
            Verdict cardVerdict = rule.verdict();
            String cardAccount = rule.account();
            for (QuestionSpec question : rule.questions()) {
                QuestionEffect effect = resolvedEffect(question, transaction, facts);
                if (effect == null) {
                    questions.add(resolveGroupKey(question, transaction));
                    continue;
                }
                mergeAttributes(attributes, effect.attributes(), rule.id() + ":" + question.code());
                if (effect.verdict() != null) {
                    cardVerdict = effect.verdict();
                }
                if (effect.account() != null) {
                    cardAccount = effect.account();
                }
            }
            // 관문 간에는 더 제한적인 판정이 이긴다(뒤 관문이 앞 판정을 완화하지 못함).
            resolvedVerdict = moreRestrictive(resolvedVerdict, cardVerdict);
            if (cardAccount != null) {
                resolvedAccount = cardAccount;
            }
            appliedRuleIds.add(rule.id());
            appliedRuleVersions.add(rule.version());
            citations.addAll(rule.citations());
        }

        Verdict verdict = questions.isEmpty()
            ? resolvedVerdict
            : moreRestrictive(resolvedVerdict, Verdict.NEEDS_REVIEW);
        String account = verdict == Verdict.UNAVAILABLE ? null : resolvedAccount;
        return new Judgment(
            verdict, null, false, null, account, appliedRuleIds, appliedRuleVersions,
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

    private static Verdict moreRestrictive(Verdict left, Verdict right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return restrictiveness(left) >= restrictiveness(right) ? left : right;
    }

    private static int restrictiveness(Verdict verdict) {
        return switch (verdict) {
            case AVAILABLE -> 0;
            case NEEDS_REVIEW -> 1;
            case UNAVAILABLE -> 2;
        };
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
