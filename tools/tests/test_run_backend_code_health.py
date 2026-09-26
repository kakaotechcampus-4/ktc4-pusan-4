from types import SimpleNamespace

import tools.run_backend_code_health as runner_module
from tools.run_backend_code_health import run_preflight


def test_preflight_writes_and_prints_partial_report_when_analyzers_fail(
    tmp_path, capsys
):
    commands = []

    def failing_command(command, **_kwargs):
        commands.append(command)
        return SimpleNamespace(returncode=1)

    report_path = run_preflight(
        tmp_path,
        run_command=failing_command,
        find_executable=lambda _name: None,
        commit="abc1234",
    )

    report = report_path.read_text(encoding="utf-8")
    assert report_path == tmp_path / "build" / "quality" / "report.md"
    assert "Commit: `abc1234`" in report
    assert "| Line Coverage | N/A | N/A | — |" in report
    assert "Codelens executable not found" in report
    assert report in capsys.readouterr().out
    assert len(commands) == 2


def test_main_runs_preflight_for_repository_commit(monkeypatch, tmp_path):
    received = {}

    def git_command(command, **_kwargs):
        assert command == ["git", "rev-parse", "HEAD"]
        return SimpleNamespace(returncode=0, stdout="abc123456789\n")

    def preflight(root, *, commit):
        received["root"] = root
        received["commit"] = commit
        return tmp_path / "report.md"

    monkeypatch.setattr(runner_module.subprocess, "run", git_command)
    monkeypatch.setattr(runner_module, "run_preflight", preflight)

    exit_code = runner_module.main()

    assert exit_code == 0
    assert received == {
        "root": runner_module.Path(runner_module.__file__).resolve().parents[1],
        "commit": "abc123456789",
    }
