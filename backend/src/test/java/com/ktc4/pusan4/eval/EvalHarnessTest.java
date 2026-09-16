package com.ktc4.pusan4.eval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.ktc4.pusan4.eval.EvalGrader.Grade;
import com.ktc4.pusan4.eval.EvalGrader.Outcome;
import com.ktc4.pusan4.judgment.domain.JudgmentEngine;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.rule.RuleCardLoader;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * eval/cases 전건을 판정·채점한다. 치명이 1건이라도 있으면 실패한다.
 *
 * <p>규칙 디렉터리는 EVAL_RULES_DIR 환경변수, 없으면 ../rules. rules/cards 가 없으면 빈 규칙셋이다.
 */
class EvalHarnessTest {

    private static final Path CASES = Path.of("..", "eval", "cases");
    private static final Path REPORT = Path.of("build", "reports", "eval", "eval-report.md");

    @Test
    void eval_cases_have_no_critical_failures() throws IOException {
        Path rules = Path.of(Objects.requireNonNullElse(System.getenv("EVAL_RULES_DIR"), "../rules"));
        boolean hasCards = Files.isDirectory(rules.resolve("cards"));
        RuleSet ruleSet = hasCards ? new RuleCardLoader().load(rules) : new RuleSet(List.of());

        Set<String> categories = new HashSet<>();
        new ObjectMapper(new YAMLFactory()).readTree(rules.resolve("categories.yaml").toFile())
            .path("categories").forEach(name -> categories.add(name.asText()));

        List<EvalCase> cases = new ArrayList<>();
        try (Stream<Path> files = Files.list(CASES)) {
            for (Path file : files.filter(f -> f.toString().endsWith(".yaml")).sorted().toList()) {
                cases.add(EvalCase.read(file, categories));
            }
        }
        assertThat(cases).as("eval/cases 케이스").isNotEmpty();
        assertThat(cases.stream().map(EvalCase::id).distinct().count()).as("케이스 id 중복").isEqualTo(cases.size());

        Map<String, EnumMap<Outcome, Integer>> tally = new TreeMap<>();
        List<String> details = new ArrayList<>();
        List<String> criticals = new ArrayList<>();
        for (EvalCase evalCase : cases) {
            Grade grade = EvalGrader.grade(evalCase, JudgmentEngine.judge(
                evalCase.transaction(), evalCase.context(), evalCase.facts(), ruleSet));
            tally.computeIfAbsent(evalCase.group(), g -> new EnumMap<>(Outcome.class))
                .merge(grade.outcome(), 1, Integer::sum);
            if (!grade.problems().isEmpty()) {
                String line = "- " + evalCase.id() + " [" + grade.outcome() + "] " + String.join(" / ", grade.problems());
                details.add(line);
                if (grade.outcome() == Outcome.CRITICAL) {
                    criticals.add(line);
                }
            }
        }

        List<String> report = new ArrayList<>(List.of(
            "# 평가셋 리포트", "",
            "규칙: " + rules.toAbsolutePath().normalize() + (hasCards ? "" : " (카드 없음 - 빈 규칙셋)"),
            "금액: 미채점 (금액 산정 미구현)", "",
            "| 관문 | 일치 | 미달 | 치명 | 보류 | 전체 |", "|---|---:|---:|---:|---:|---:|"));
        tally.forEach((group, counts) -> report.add("| %s | %d | %d | %d | %d | %d |".formatted(group,
            counts.getOrDefault(Outcome.MATCH, 0), counts.getOrDefault(Outcome.SHORTFALL, 0),
            counts.getOrDefault(Outcome.CRITICAL, 0), counts.getOrDefault(Outcome.ON_HOLD, 0),
            counts.values().stream().mapToInt(Integer::intValue).sum())));
        report.add("");
        report.addAll(details);
        Files.createDirectories(REPORT.getParent());
        Files.writeString(REPORT, String.join("\n", report) + "\n");
        System.out.println(String.join("\n", report));

        assertThat(criticals).as("치명 케이스 (리포트: %s)", REPORT.toAbsolutePath()).isEmpty();
    }
}
