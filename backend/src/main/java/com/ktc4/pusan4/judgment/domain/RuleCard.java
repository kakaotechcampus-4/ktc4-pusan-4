package com.ktc4.pusan4.judgment.domain;

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
    List<QuestionSpec> questions
) {
    public RuleCard {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(gate, "gate must not be null");
        Objects.requireNonNull(match, "match must not be null");
        citations = citations == null ? List.of() : List.copyOf(citations);
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
        questions = questions == null ? List.of() : List.copyOf(questions);
    }
}
