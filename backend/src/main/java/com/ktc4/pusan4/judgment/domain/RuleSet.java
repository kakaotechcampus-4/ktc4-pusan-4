package com.ktc4.pusan4.judgment.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** 로딩 시 관문별로 정렬해 여러 거래 판정에서 재사용하는 규칙 목록. */
public final class RuleSet {

    private static final Comparator<RuleCard> PRIORITY = Comparator
        .comparingInt(RuleCard::priority).reversed()
        .thenComparing(RuleCard::id);

    private static final Comparator<RuleCard> WINNER = Comparator
        .comparingInt(RuleCard::priority).reversed()
        .thenComparing(Comparator.comparingInt(RuleSet::specificity).reversed())
        .thenComparing(RuleCard::id);

    private final Map<Gate, List<RuleCard>> rulesByGate;

    public RuleSet(List<RuleCard> rules) {
        Map<Gate, List<RuleCard>> grouped = new EnumMap<>(Gate.class);
        for (RuleCard rule : rules) {
            grouped.computeIfAbsent(rule.gate(), ignored -> new ArrayList<>()).add(rule);
        }
        grouped.replaceAll((gate, cards) ->
            cards.stream().sorted(gate == Gate.G1 ? PRIORITY : WINNER).toList()
        );
        rulesByGate = Map.copyOf(grouped);
    }

    public List<RuleCard> get(Gate gate) {
        return rulesByGate.getOrDefault(gate, List.of());
    }

    private static int specificity(RuleCard card) {
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
}
