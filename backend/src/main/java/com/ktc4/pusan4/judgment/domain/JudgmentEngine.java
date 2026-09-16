package com.ktc4.pusan4.judgment.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
                false,
                rule.account(),
                List.of(rule.id()),
                List.of(rule.version()),
                rule.citations(),
                rule.attributes(),
                List.of()
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
                Verdict.NEEDS_REVIEW, Gate.G2, true, UnmatchedReason.RULE_NOT_FOUND, false, null,
                List.of(), List.of(), List.of(), java.util.Map.of(), List.of()
            );
        }
        Map<String, Object> attributes = new LinkedHashMap<>();
        List<QuestionSpec> questions = new ArrayList<>();
        List<String> appliedRuleIds = new ArrayList<>();
        List<Integer> appliedRuleVersions = new ArrayList<>();
        LinkedHashSet<Citation> citations = new LinkedHashSet<>();
        Verdict resolvedVerdict = null;
        boolean outOfScope = false;
        String defaultAccount = null;
        String answeredAccount = null;
        boolean answeredAccountConflict = false;

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
            outOfScope |= rule.outOfScope();
            // 카드의 기본 판정을, 그 카드의 되묻기 응답(effect)이 있으면 대체한다.
            Verdict cardVerdict = rule.verdict();
            if (defaultAccount == null && rule.account() != null) {
                defaultAccount = rule.account();
            }
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
                    if (answeredAccount == null) {
                        answeredAccount = effect.account();
                    } else if (!answeredAccount.equals(effect.account())) {
                        // 답변끼리 계정과목이 엇갈리면 이 거래만 검토로 돌린다(배치 중단 방지).
                        answeredAccountConflict = true;
                    }
                }
            }
            // 관문 간에는 더 제한적인 판정이 이긴다(뒤 관문이 앞 판정을 완화하지 못함).
            resolvedVerdict = moreRestrictive(resolvedVerdict, cardVerdict);
            appliedRuleIds.add(rule.id());
            appliedRuleVersions.add(rule.version());
            citations.addAll(rule.citations());
        }

        // 이미 불가로 확정된 거래는 되묻지 않는다: 미해소 질문을 버려 되묻기 예산 낭비를 막는다.
        if (resolvedVerdict == Verdict.UNAVAILABLE) {
            questions.clear();
        }
        // 미해소 질문이 결과를 바꿀 수 있을 때만 검토로 전환한다. 가산세 플래그만 세우는
        // G5 증빙 질문은 판정을 끌어내리지 않는다 — 경비 인정 여부는 앞 관문이 이미 확정했다.
        // 질문 자체는 그대로 실어 보내므로 화면은 여전히 되묻는다.
        boolean review = questions.stream().anyMatch(JudgmentEngine::changesOutcome)
            || answeredAccountConflict;
        Verdict verdict = review
            ? moreRestrictive(resolvedVerdict, Verdict.NEEDS_REVIEW)
            : resolvedVerdict;
        String account = verdict == Verdict.UNAVAILABLE || answeredAccountConflict
            ? null
            : answeredAccount == null ? defaultAccount : answeredAccount;
        return new Judgment(
            verdict, null, false, null, outOfScope, account, appliedRuleIds, appliedRuleVersions,
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

    // 답이 당해 경비 '금액'을 바꾸는 속성. 자산화되면 당해 경비는 상각액뿐이라,
    // 답을 듣기 전에 가능으로 확정하면 사용자가 전액 경비로 읽는다(금액 과대계상).
    // 가산세_대상 같은 속성은 여기 없다 — 가산세를 계산할 뿐 경비 금액을 건드리지 않는다.
    private static final Set<String> AMOUNT_BEARING_ATTRIBUTES = Set.of("자산", "즉시상각");

    // 판정·계정과목·금액 중 하나라도 답에 따라 갈리면 확정하지 않는다.
    private static boolean changesOutcome(QuestionSpec question) {
        return question.effects().values().stream()
            .anyMatch(effect -> effect.verdict() != null
                || effect.account() != null
                || !Collections.disjoint(effect.attributes().keySet(), AMOUNT_BEARING_ATTRIBUTES));
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
