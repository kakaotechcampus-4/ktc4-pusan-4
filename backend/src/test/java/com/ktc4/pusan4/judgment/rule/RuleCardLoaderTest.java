package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.RuleCard;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RuleCardLoaderTest {

    @TempDir
    Path root;

    @Test
    void loads_only_cards_directory_in_priority_order() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("normalize.yaml"), "not: a-card");
        Files.writeString(root.resolve("cards/R-020.yaml"), cardYaml("R-020", 300));
        Files.writeString(root.resolve("cards/R-010.yaml"), cardYaml("R-010", 900));

        List<RuleCard> cards = new RuleCardLoader().load(root);

        assertThat(cards).extracting(RuleCard::id).containsExactly("R-010", "R-020");
    }

    @Test
    void rejects_equal_blocking_rules_with_same_match() throws IOException {
        Files.createDirectories(root.resolve("cards"));
        Files.writeString(root.resolve("cards/R-010.yaml"), cardYaml("R-010", 500));
        Files.writeString(root.resolve("cards/R-020.yaml"), cardYaml("R-020", 500));

        assertThatThrownBy(() -> new RuleCardLoader().load(root))
            .isInstanceOf(RuleCardValidationException.class)
            .hasMessageContaining("R-010")
            .hasMessageContaining("R-020");
    }

    private static String cardYaml(String id, int priority) {
        return """
            id: %s
            version: 1
            gate: G1
            priority: %d
            effective_period:
              start: 2025-01-01
              end: null
            match:
              category: [지자체_과태료]
            verdict: UNAVAILABLE
            citations: [소득세법-33-1-2]
            review:
              by: 외부자문
              date: 2026-09-05
            """.formatted(id, priority);
    }
}
