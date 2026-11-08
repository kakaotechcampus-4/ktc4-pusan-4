package com.ktc4.pusan4.judgment.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** 로딩 시 관문별로 정렬해 여러 거래 판정에서 재사용하는 규칙 목록. */
public final class RuleSet {

    private static final Comparator<RuleCard> WINNER = Comparator
        .comparingInt(RuleCard::priority).reversed()
        .thenComparing(Comparator.comparingInt((RuleCard card) -> card.match().specificity()).reversed())
        .thenComparing(RuleCard::id);

    private final Map<Gate, List<RuleCard>> rulesByGate;
    private final Set<String> statuteIds;
    private final Map<String, PreviousAnswer> previousAnswers;
    private final Map<String, String> accountLabels;

    public RuleSet(List<RuleCard> rules) {
        this(rules, Map.of());
    }

    /** @param accountLabels 계정과목 ID → 화면 이름 (rules/accounts.yaml). 이름이 ID 와 같은 계정과목은 없어도 된다 */
    public RuleSet(List<RuleCard> rules, Map<String, String> accountLabels) {
        Map<Gate, List<RuleCard>> grouped = new EnumMap<>(Gate.class);
        for (RuleCard rule : rules) {
            grouped.computeIfAbsent(rule.gate(), ignored -> new ArrayList<>()).add(rule);
        }
        grouped.replaceAll((gate, cards) ->
            cards.stream().sorted(WINNER).toList()
        );
        rulesByGate = Map.copyOf(grouped);
        statuteIds = rules.stream()
            .flatMap(RuleSet::citations)
            .map(Citation::statuteId)
            .collect(Collectors.toUnmodifiableSet());
        Map<String, PreviousAnswer> byCode = new HashMap<>();
        rules.stream().flatMap(card -> card.questions().stream()).forEach(question -> {
            PreviousAnswer known = byCode.putIfAbsent(question.code(), question.previousAnswer());
            if (known != null && known != question.previousAnswer()) {
                throw new IllegalArgumentException("question code " + question.code() + " has two previous_answer tiers");
            }
        });
        previousAnswers = Map.copyOf(byCode);
        this.accountLabels = Map.copyOf(accountLabels);
    }

    public List<RuleCard> get(Gate gate) {
        return rulesByGate.getOrDefault(gate, List.of());
    }

    /** 판정이 인용할 수 있는 조문 ID. 엔진은 카드 근거나, 질문에 답했으면 그 선택지의 근거를 싣는다. */
    public Set<String> statuteIds() {
        return statuteIds;
    }

    /**
     * 질문 코드의 지난번 답 등급. 저장된 질문은 코드(question_queue.reason_code)만 남아 카드를 코드로 찾는다.
     * 지금 카드에 없는 코드(지워진 카드)는 NONE 이다.
     */
    public PreviousAnswer previousAnswer(String questionCode) {
        return previousAnswers.getOrDefault(questionCode, PreviousAnswer.NONE);
    }

    /**
     * 계정과목의 화면 이름. 판정에는 ID(account)가 저장되고 비교도 ID 로 한다. 이름이 따로 없으면 ID 그대로다.
     */
    public String accountLabel(String account) {
        return account == null ? null : accountLabels.getOrDefault(account, account);
    }

    private static Stream<Citation> citations(RuleCard card) {
        return Stream.concat(
            card.citations().stream(),
            card.questions().stream()
                .flatMap(question -> question.effects().values().stream())
                .flatMap(effect -> effect.citations().stream())
        );
    }
}
