package com.ktc4.pusan4.judgment.domain;

import java.util.List;
import java.util.Map;

public record QuestionSpec(
    String code,
    String text,
    String factType,
    String groupBy,
    List<String> options,
    Map<String, QuestionEffect> effects
) {
    public QuestionSpec {
        options = options == null ? List.of() : List.copyOf(options);
        effects = effects == null ? Map.of() : Map.copyOf(effects);
    }

    public QuestionSpec(
        String code,
        String text,
        String factType,
        String groupBy,
        List<String> options
    ) {
        this(code, text, factType, groupBy, options, Map.of());
    }

    public QuestionEffect effectFor(String selectedValue) {
        if (!options.contains(selectedValue)) {
            return null;
        }
        return effects.getOrDefault(selectedValue, QuestionEffect.none());
    }
}
