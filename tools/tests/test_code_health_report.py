import json

import pytest

import tools.code_health_report as report_module
from tools.code_health_report import build_metrics, render_report


def test_build_metrics_combines_reports_and_deduplicates_complex_methods(tmp_path):
    jacoco = tmp_path / "jacoco.xml"
    jacoco.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
        <report name="backend">
          <counter type="LINE" missed="20" covered="80"/>
          <counter type="BRANCH" missed="3" covered="7"/>
        </report>
        """,
        encoding="utf-8",
    )

    codelens = tmp_path / "codelens.json"
    codelens.write_text(
        json.dumps(
            {
                "analysis": {
                    "summary": {
                        "lines": {"total": 100},
                        "complexity": {"cognitive": 231},
                    }
                },
                "health": {"score": 84.2, "grade": "B", "worst_files": []},
            }
        ),
        encoding="utf-8",
    )

    pmd = tmp_path / "pmd.xml"
    pmd.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
        <pmd xmlns="https://pmd-code.org/schema/report/2.0.0">
          <file name="src/main/java/Foo.java">
            <violation beginline="1" endline="1" rule="CyclomaticComplexity" priority="3">The class 'Foo' has a total cyclomatic complexity of 133.</violation>
            <violation beginline="10" endline="10" rule="CognitiveComplexity" priority="3" method="run">The method 'run' has a cognitive complexity of 17.</violation>
            <violation beginline="10" endline="10" rule="CyclomaticComplexity" priority="3" method="run">The method 'run' has a cyclomatic complexity of 12.</violation>
            <violation beginline="30" endline="30" rule="CognitiveComplexity" priority="3" method="load">The method 'load' has a cognitive complexity of 18.</violation>
          </file>
        </pmd>
        """,
        encoding="utf-8",
    )

    cpd = tmp_path / "cpd.xml"
    cpd.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
        <pmd-cpd xmlns="https://pmd-code.org/schema/cpd-report">
          <duplication lines="5" tokens="100">
            <file path="src/main/java/Foo.java" line="10" endline="14"/>
            <file path="src/main/java/Bar.java" line="20" endline="24"/>
          </duplication>
          <duplication lines="3" tokens="60">
            <file path="src/main/java/Foo.java" line="12" endline="14"/>
            <file path="src/main/java/Baz.java" line="1" endline="3"/>
          </duplication>
        </pmd-cpd>
        """,
        encoding="utf-8",
    )

    metrics = build_metrics(jacoco, codelens, pmd, cpd, commit="abc1234")

    assert metrics["commit"] == "abc1234"
    assert metrics["line_coverage"] == pytest.approx(80.0)
    assert metrics["branch_coverage"] == pytest.approx(70.0)
    assert metrics["health_score"] == pytest.approx(84.2)
    assert metrics["health_grade"] == "B"
    assert metrics["cognitive_complexity"] == 231
    assert metrics["duplicated_lines"] == 13
    assert metrics["duplication_percent"] == pytest.approx(13.0)
    assert metrics["high_complexity_methods"] == 2
    assert metrics["pmd_issue_count"] == 4
    assert len(metrics["complexity_issues"]) == 3
    assert len(metrics["duplication_blocks"]) == 2


def test_render_report_compares_base_and_highlights_attention_items():
    current = {
        "commit": "abc123456789",
        "line_coverage": 81.3,
        "branch_coverage": 72.1,
        "health_score": 84.2,
        "health_grade": "B",
        "duplication_percent": 4.1,
        "high_complexity_methods": 7,
        "complexity_issues": [
            {
                "path": "backend/src/main/java/RuleMatcher.java",
                "line": 42,
                "rule": "CognitiveComplexity",
                "value": 21,
                "message": "The method 'match' has a cognitive complexity of 21.",
            }
        ],
        "duplication_blocks": [
            {
                "lines": 12,
                "tokens": 100,
                "occurrences": [
                    {"path": "backend/src/main/java/Foo.java", "line": 10, "endline": 21},
                    {"path": "backend/src/main/java/Bar.java", "line": 20, "endline": 31},
                ],
            }
        ],
        "warnings": [],
    }
    baseline = {
        "line_coverage": 79.8,
        "branch_coverage": 70.4,
        "health_score": 82.7,
        "health_grade": "B",
        "duplication_percent": 3.8,
        "high_complexity_methods": 6,
    }

    report = render_report(current, baseline)

    assert report.startswith("<!-- backend-code-health-report -->")
    assert "Commit: `abc1234`" in report
    assert "| Line Coverage | 81.3% | 79.8% | +1.5 pp ✅ |" in report
    assert "| Code Health | 84.2 (B) | 82.7 (B) | +1.5 ✅ |" in report
    assert "| Duplicated Lines | 4.1% | 3.8% | +0.3 pp ⚠️ |" in report
    assert "| High-complexity Methods | 7 | 6 | +1 ⚠️ |" in report
    assert "`backend/src/main/java/RuleMatcher.java:42` — Cognitive Complexity 21" in report
    assert "Duplicated block (12 lines): `backend/src/main/java/Foo.java:10` ↔ `backend/src/main/java/Bar.java:20`" in report


def test_render_report_shows_pmd_issue_count_and_non_complexity_issues():
    current = {
        "commit": "abc1234",
        "pmd_issue_count": 2,
        "complexity_issues": [],
        "pmd_issues": [
            {
                "path": "backend/src/main/java/Foo.java",
                "line": 31,
                "rule": "BrokenNullCheck",
                "message": "Avoid null checks that can never succeed.",
            },
            {
                "path": "backend/src/main/java/Bar.java",
                "line": 82,
                "rule": "EmptyCatchBlock",
                "message": "Avoid empty catch blocks.",
            },
        ],
        "duplication_blocks": [],
        "warnings": [],
    }
    baseline = {"pmd_issue_count": 1}

    report = render_report(current, baseline)

    assert "| PMD Issues | 2 | 1 | +1 ⚠️ |" in report
    assert "### Code Issues" in report
    assert (
        "`backend/src/main/java/Foo.java:31` — Broken Null Check: "
        "Avoid null checks that can never succeed."
    ) in report
    assert (
        "`backend/src/main/java/Bar.java:82` — Empty Catch Block: "
        "Avoid empty catch blocks."
    ) in report


def test_render_report_groups_complexity_rules_for_the_same_method():
    current = {
        "commit": "abc1234",
        "complexity_issues": [
            {
                "path": "backend/src/main/java/Foo.java",
                "line": 10,
                "method": "run",
                "rule": "CognitiveComplexity",
                "value": 30,
            },
            {
                "path": "backend/src/main/java/Foo.java",
                "line": 10,
                "method": "run",
                "rule": "CyclomaticComplexity",
                "value": 21,
            },
        ],
        "pmd_issues": [],
        "duplication_blocks": [],
        "warnings": [],
    }

    report = render_report(current)

    assert report.count("`backend/src/main/java/Foo.java:10`") == 1
    assert "Cognitive Complexity 30 / Cyclomatic Complexity 21" in report


def test_build_metrics_marks_missing_reports_as_unavailable(tmp_path):
    missing = tmp_path / "missing"

    metrics = build_metrics(missing, missing, missing, missing, commit="abc1234")

    assert metrics["line_coverage"] is None
    assert metrics["branch_coverage"] is None
    assert metrics["health_score"] is None
    assert metrics["duplication_percent"] is None
    assert metrics["high_complexity_methods"] is None
    assert metrics["pmd_issue_count"] is None
    assert len(metrics["warnings"]) == 4


def test_main_writes_metrics_and_markdown_even_when_reports_are_missing(tmp_path):
    missing = tmp_path / "missing"
    metrics_output = tmp_path / "out" / "metrics.json"
    report_output = tmp_path / "out" / "report.md"

    exit_code = report_module.main(
        [
            "--jacoco",
            str(missing),
            "--codelens",
            str(missing),
            "--pmd",
            str(missing),
            "--cpd",
            str(missing),
            "--commit",
            "abc1234",
            "--metrics-output",
            str(metrics_output),
            "--report-output",
            str(report_output),
        ]
    )

    assert exit_code == 0
    assert json.loads(metrics_output.read_text(encoding="utf-8"))["commit"] == "abc1234"
    assert report_output.read_text(encoding="utf-8").startswith(
        "<!-- backend-code-health-report -->"
    )
    assert "| Line Coverage | N/A | N/A | — |" in report_output.read_text(
        encoding="utf-8"
    )
