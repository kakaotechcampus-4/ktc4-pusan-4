package com.ktc4.pusan4.judgment.domain;

import java.util.List;

public record QuestionSpec(String code, String text, String factType, String groupBy, List<String> options) {
    public QuestionSpec {
        options = options == null ? List.of() : List.copyOf(options);
    }
}
