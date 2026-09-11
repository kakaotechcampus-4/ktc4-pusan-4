package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record RuleCard(
    String id,
    int version,
    Gate gate,
    int priority,
    RuleMatch match,
    Verdict verdict,
    String account,
    List<Citation> citations,
    Map<String, Object> attributes,
    List<QuestionSpec> questions,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    String reviewedBy,
    LocalDate reviewedAt
) {
    public RuleCard {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(gate, "gate must not be null");
        Objects.requireNonNull(match, "match must not be null");
        citations = citations == null ? List.of() : List.copyOf(citations);
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
        questions = questions == null ? List.of() : List.copyOf(questions);
    }

    public RuleCard(
        String id,
        int version,
        Gate gate,
        int priority,
        RuleMatch match,
        Verdict verdict,
        String account,
        List<Citation> citations,
        Map<String, Object> attributes,
        List<QuestionSpec> questions
    ) {
        this(
            id, version, gate, priority, match, verdict, account, citations, attributes, questions,
            LocalDate.MIN, null, "test", LocalDate.MIN
        );
    }

    public boolean isEffectiveOn(LocalDate date) {
        return !date.isBefore(effectiveFrom) && (effectiveTo == null || !date.isAfter(effectiveTo));
    }
}
