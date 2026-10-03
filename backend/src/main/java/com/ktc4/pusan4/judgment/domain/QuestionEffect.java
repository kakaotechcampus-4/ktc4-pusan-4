package com.ktc4.pusan4.judgment.domain;

import java.util.List;
import java.util.Map;

// citations: 이 답을 골랐을 때 카드 citations 대신 실을 근거. 비어 있으면 카드 citations 를 쓴다.
public record QuestionEffect(
    Verdict verdict,
    String account,
    Map<String, Object> attributes,
    List<Citation> citations
) {
    public QuestionEffect {
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
        citations = citations == null ? List.of() : List.copyOf(citations);
    }

    public QuestionEffect(Verdict verdict, String account, Map<String, Object> attributes) {
        this(verdict, account, attributes, List.of());
    }

    public static QuestionEffect none() {
        return new QuestionEffect(null, null, Map.of());
    }
}
