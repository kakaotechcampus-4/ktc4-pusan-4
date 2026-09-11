package com.ktc4.pusan4.judgment.domain;

import java.util.List;
import java.util.Map;

public record Judgment(
    Verdict verdict,
    Gate blockedAtGate,
    boolean inference,
    UnmatchedReason unmatchedReason,
    String account,
    List<String> appliedRuleIds,
    List<Integer> appliedRuleVersions,
    List<Citation> citations,
    Map<String, Object> attributes,
    List<QuestionSpec> questions
) {
    public Judgment {
        appliedRuleIds = List.copyOf(appliedRuleIds);
        appliedRuleVersions = List.copyOf(appliedRuleVersions);
        citations = List.copyOf(citations);
        attributes = Map.copyOf(attributes);
        questions = List.copyOf(questions);
    }

    public Judgment(
        Verdict verdict,
        Gate blockedAtGate,
        boolean inference,
        UnmatchedReason unmatchedReason,
        String account,
        List<String> appliedRuleIds,
        List<Citation> citations,
        Map<String, Object> attributes,
        List<QuestionSpec> questions
    ) {
        this(
            verdict, blockedAtGate, inference, unmatchedReason, account,
            appliedRuleIds, appliedRuleIds.stream().map(ignored -> 0).toList(),
            citations, attributes, questions
        );
    }
}
