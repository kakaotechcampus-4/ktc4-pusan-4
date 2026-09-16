package com.ktc4.pusan4.judgment.domain;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RuleSetTest {

    @ParameterizedTest
    @EnumSource(Gate.class)
    void preserves_gate_specific_order(Gate gate) {
        RuleSet rules = new RuleSet(List.of(
            card("R-030", gate, 500, RuleMatch.categories("카페")),
            card("R-010", gate, 500, RuleMatch.categories("카페")),
            card("R-020", gate, 500,
                new RuleMatch(List.of("카페"), List.of(), List.of("커피"), null, null, List.of())),
            card("R-040", gate, 900, RuleMatch.categories("카페"))
        ));

        // 모든 관문이 동일하게 priority → specificity → id로 정렬된다(G1도 WINNER 사용).
        assertThat(rules.get(gate)).extracting(RuleCard::id)
            .containsExactly("R-040", "R-020", "R-010", "R-030");
    }

    private static RuleCard card(String id, Gate gate, int priority, RuleMatch match) {
        return new RuleCard(
            id, 1, gate, priority, match, Verdict.AVAILABLE, null,
            List.of(new Citation("근거")), Map.of(), List.of()
        );
    }
}
