package com.ktc4.pusan4.judgment.domain;

import java.util.Map;

public record QuestionEffect(Verdict verdict, String account, Map<String, Object> attributes) {
    public QuestionEffect {
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }

    public static QuestionEffect none() {
        return new QuestionEffect(null, null, Map.of());
    }
}
