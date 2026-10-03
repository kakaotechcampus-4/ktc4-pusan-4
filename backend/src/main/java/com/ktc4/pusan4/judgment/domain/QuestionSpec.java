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

    // 답에 따라 불가가 풀리는 선택지가 있다. 한 카드의 판정은 그 카드 질문의 답이 대체한다.
    public boolean canLiftUnavailable() {
        return effects.values().stream()
            .anyMatch(effect -> effect.verdict() != null && effect.verdict() != Verdict.UNAVAILABLE);
    }
}
