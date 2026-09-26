import json
import os
import shutil
import subprocess
from pathlib import Path

if __package__:
    from .code_health_report import build_metrics, render_report
else:
    from code_health_report import build_metrics, render_report


def run_preflight(
    root: Path,
    *,
    run_command=subprocess.run,
    find_executable=shutil.which,
    commit: str = "local",
) -> Path:
    quality_dir = root / "build" / "quality"
    report_paths = {
        "jacoco": root / "backend" / "build" / "reports" / "jacoco" / "combined.xml",
        "codelens": quality_dir / "codelens.json",
        "pmd": root / "backend" / "build" / "reports" / "pmd" / "main.xml",
        "cpd": root / "backend" / "build" / "reports" / "cpd" / "main.xml",
    }
    for path in report_paths.values():
        path.unlink(missing_ok=True)

    wrapper_name = "gradlew.bat" if os.name == "nt" else "gradlew"
    gradle = str(root / "backend" / wrapper_name)
    warnings = []
    commands = [
        (
            "PMD/CPD",
            [gradle, "-p", "backend", "pmdMain", "cpdMain", "--continue"],
        ),
        (
            "JaCoCo",
            [gradle, "-p", "backend", "jacocoCombinedReport", "--continue"],
        ),
    ]
    for label, command in commands:
        result = run_command(command, cwd=root, check=False)
        if result.returncode:
            warnings.append(f"{label} command failed with exit code {result.returncode}.")

    codelens = find_executable("codelens")
    if codelens:
        quality_dir.mkdir(parents=True, exist_ok=True)
        result = run_command(
            [
                codelens,
                "backend/src/main/java",
                "--by-file",
                "-f",
                "json",
                "-O",
                str(report_paths["codelens"]),
            ],
            cwd=root,
            check=False,
        )
        if result.returncode:
            warnings.append(
                f"Codelens command failed with exit code {result.returncode}."
            )
    else:
        warnings.append("Codelens executable not found on PATH.")

    metrics = build_metrics(
        report_paths["jacoco"],
        report_paths["codelens"],
        report_paths["pmd"],
        report_paths["cpd"],
        commit,
    )
    metrics["warnings"].extend(warnings)
    report = render_report(metrics)

    quality_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = quality_dir / "metrics.json"
    report_path = quality_dir / "report.md"
    metrics_path.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report_path.write_text(report, encoding="utf-8")
    print(report)
    return report_path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    commit = result.stdout.strip() if result.returncode == 0 else "local"
    run_preflight(root, commit=commit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
