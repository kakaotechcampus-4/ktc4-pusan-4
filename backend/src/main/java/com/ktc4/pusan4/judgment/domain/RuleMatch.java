package com.ktc4.pusan4.judgment.domain;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Set;

public record RuleMatch(
    List<String> categories,
    List<String> excludedCategories,
    List<String> keywords,
    Long amountMin,
    Long amountMax,
    List<String> industries,
    Set<DayOfWeek> weekdays
) {
    public RuleMatch {
        categories = copy(categories);
        excludedCategories = copy(excludedCategories);
        keywords = copy(keywords);
        industries = copy(industries);
        weekdays = weekdays == null ? Set.of() : Set.copyOf(weekdays);
    }

    public static RuleMatch categories(String... categories) {
        return new RuleMatch(List.of(categories), List.of(), List.of(), null, null, List.of(), Set.of());
    }

    public static RuleMatch any() {
        return new RuleMatch(List.of(), List.of(), List.of(), null, null, List.of(), Set.of());
    }

    // 같은 priority에서 더 구체적인 match가 이긴다: 조건별 가중치의 합.
    // 승자 정렬(RuleSet)과 차단 카드 충돌 검증(RuleCardLoader)이 공유하는 단일 기준.
    // 사람용 설명은 CONTEXT.md "승자 결정 — best-match" 섹션.
    public int specificity() {
        int score = 0;
        if (!keywords.isEmpty()) {
            score += 100;
        }
        if (!categories.isEmpty()) {
            score += 50;
        }
        if (!industries.isEmpty()) {
            score += 30;
        }
        if (amountMin != null || amountMax != null) {
            score += 20;
        }
        return score;
    }

    private static List<String> copy(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
