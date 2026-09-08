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
    List<Citation> citations,
    Map<String, Object> attributes,
    List<QuestionSpec> questions
) {
    public Judgment {
        appliedRuleIds = List.copyOf(appliedRuleIds);
        citations = List.copyOf(citations);
        attributes = Map.copyOf(attributes);
        questions = List.copyOf(questions);
    }
}
