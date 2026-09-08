package com.ktc4.pusan4.judgment.domain;

import java.util.List;

public record RuleMatch(
    List<String> categories,
    List<String> excludedCategories,
    List<String> keywords,
    Long amountMin,
    Long amountMax,
    List<String> industries
) {
    public RuleMatch {
        categories = copy(categories);
        excludedCategories = copy(excludedCategories);
        keywords = copy(keywords);
        industries = copy(industries);
    }

    public static RuleMatch categories(String... categories) {
        return new RuleMatch(List.of(categories), List.of(), List.of(), null, null, List.of());
    }

    public static RuleMatch any() {
        return new RuleMatch(List.of(), List.of(), List.of(), null, null, List.of());
    }

    private static List<String> copy(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
