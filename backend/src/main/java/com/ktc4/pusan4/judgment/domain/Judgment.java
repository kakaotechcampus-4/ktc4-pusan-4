package com.ktc4.pusan4.judgment.domain;

import java.util.List;
import java.util.Map;

public record Judgment(
    Verdict verdict,
    Gate blockedAtGate,
    boolean inference,
    UnmatchedReason unmatchedReason,
    boolean outOfScope,
    String account,
    List<String> appliedRuleIds,
    List<Integer> appliedRuleVersions,
    List<Citation> citations,
    Map<String, Object> attributes,
    List<QuestionSpec> questions,
    List<UserFact> usedFacts
) {
    /** usedFacts: 질문을 실제로 푼 답. 판정 기록에 이 답들만 남긴다(judgment_input_fact). */
    public Judgment {
        appliedRuleIds = List.copyOf(appliedRuleIds);
        appliedRuleVersions = List.copyOf(appliedRuleVersions);
        citations = List.copyOf(citations);
        attributes = Map.copyOf(attributes);
        questions = List.copyOf(questions);
        usedFacts = List.copyOf(usedFacts);
    }

    /** 답을 쓰지 않은 판정. */
    public Judgment(
        Verdict verdict,
        Gate blockedAtGate,
        boolean inference,
        UnmatchedReason unmatchedReason,
        boolean outOfScope,
        String account,
        List<String> appliedRuleIds,
        List<Integer> appliedRuleVersions,
        List<Citation> citations,
        Map<String, Object> attributes,
        List<QuestionSpec> questions
    ) {
        this(
            verdict, blockedAtGate, inference, unmatchedReason, outOfScope, account,
            appliedRuleIds, appliedRuleVersions, citations, attributes, questions, List.of()
        );
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
            verdict, blockedAtGate, inference, unmatchedReason, false, account,
            appliedRuleIds, appliedRuleIds.stream().map(ignored -> 0).toList(),
            citations, attributes, questions
        );
    }
}
