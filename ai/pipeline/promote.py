"""승인한 규칙 후보를 모아 카드 PR 하나로 올린다. 주 1회 배치(deploy/rule-candidates.sh).

후보는 DB, 확정 카드는 git 이다(CONTEXT.md 6). 관리자가 승인한 후보의 draft_yaml 에
id · 효력 시작일 · 검토를 채워 rules/cards/ 에 올리고, 머지는 사람이 CI 를 보고 한다.

후보 상태는 pr_url · promoted_rule_id 로 가른다.
  승인 · pr_url 없음            다음 실행 때 PR 에 들어간다
  승인 · pr_url 있음            PR 이 열려 있다
  승인 · promoted_rule_id 있음  develop 에 카드 파일이 들어갔다
PR 이 닫혔는데 develop 에 파일이 없으면 대기로 되돌려 다시 심사받게 한다. 머지 여부가 아니라
파일로 보는 건 PR 에서 카드 하나만 지우고 머지할 수 있어서다.

reviewed_by(관리자 이메일)는 읽지 않는다. 레포가 공개라 카드나 PR 에 남으면 안 된다.

사용:
    python -m pipeline.promote --dry-run
    python -m pipeline.promote
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import urllib.error
import urllib.request
from datetime import date, datetime
from urllib.parse import quote
from zoneinfo import ZoneInfo

import psycopg
import yaml
from psycopg.rows import dict_row

from app.config import settings

KST = ZoneInfo("Asia/Seoul")
BASE = "develop"

_OPEN = """
SELECT id, merchant_category, pr_url FROM rule_candidate
 WHERE status = '승인' AND pr_url IS NOT NULL AND promoted_rule_id IS NULL
"""
_APPROVED = """
SELECT id, merchant_category, industry_code, draft_yaml, reviewed_at FROM rule_candidate
 WHERE status = '승인' AND pr_url IS NULL
 ORDER BY id
"""
_REVERT = """
UPDATE rule_candidate SET status = '대기', pr_url = NULL, reviewed_by = NULL, reviewed_at = NULL
 WHERE id = %s
"""


def card_id(candidate_id: int) -> str:
    return f"R-C{candidate_id}"


def card_path(candidate_id: int, category: str) -> str:
    # 생성 카드 패턴(ProfileCardGenerator, R-\d{9}_)과 달라야 카드 재생성 때 지워지지 않는다
    return f"rules/cards/{card_id(candidate_id)}_{category}.yaml"


def finalize(draft_yaml: str, candidate_id: int, approved: date) -> str:
    """draft.render() 초안의 자리표시 줄을 채운다. 소급하지 않아 효력 시작일은 승인일이다."""
    lines = draft_yaml.splitlines()
    for prefix, new in (
        ("# 자동 생성 초안이다", f"# 규칙 후보 #{candidate_id} 에서 승격. 승인 {approved}"),
        ("# id 와 effective_period.start", ""),
        ("id: TODO", f"id: {card_id(candidate_id)}"),
        ("effective_period: { start: TODO", f"effective_period: {{ start: {approved}, end: null }}"),
        ("review: { by: 미검수", f"review: {{ by: 관리자, date: {approved} }}"),
    ):
        hits = [i for i, line in enumerate(lines) if line.startswith(prefix)]
        if len(hits) != 1:
            raise ValueError(f"초안 형식이 다르다: '{prefix}' 줄 {len(hits)}개")
        lines[hits[0]] = new
    return "\n".join(line for line in lines if line) + "\n"


def _gh(method: str, path: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"https://api.github.com/repos/{settings.rules_pr_repo}/{path}",
        data=None if body is None else json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.rules_pr_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "ktc4-rule-promote",
        },
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def on_develop(path: str) -> bool:
    try:
        _gh("GET", f"contents/{quote(path)}?ref={BASE}")
        return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise


def sync(conn: psycopg.Connection) -> None:
    """닫힌 PR 의 후보를 develop 반영 또는 대기로 정리한다."""
    for r in conn.execute(_OPEN).fetchall():
        # 권한이 없으면 여기서 404 로 멈춘다. 그래야 아래 파일 404 를 "없음"으로 믿을 수 있다
        if _gh("GET", f"pulls/{r['pr_url'].rsplit('/', 1)[1]}")["state"] == "open":
            continue
        if on_develop(card_path(r["id"], r["merchant_category"])):
            conn.execute("UPDATE rule_candidate SET promoted_rule_id = %s WHERE id = %s",
                         (card_id(r["id"]), r["id"]))
            print(f"  #{r['id']} {card_id(r['id'])} develop 반영")
        else:
            conn.execute(_REVERT, (r["id"],))
            print(f"  #{r['id']} {r['merchant_category']} PR 이 닫혔는데 카드가 없어 대기로 되돌림")


def open_pr(files: dict[int, tuple[str, str]], title: str, body: str) -> str:
    """후보 id -> (경로, 본문) 을 새 브랜치에 커밋하고 develop 대상 PR 을 연다."""
    branch = f"feature/rule-candidates-{datetime.now(KST).date()}"
    head = _gh("GET", f"git/ref/heads/{BASE}")["object"]["sha"]
    # shortcut: 같은 날 다시 돌리면 브랜치가 이미 있어 422 다, 잦아지면 이름에 시각을 붙인다
    _gh("POST", "git/refs", {"ref": f"refs/heads/{branch}", "sha": head})
    for cid, (path, text) in files.items():
        _gh("PUT", f"contents/{quote(path)}", {
            "message": f"feat: 규칙 후보 #{cid} 카드 추가",
            "content": base64.b64encode(text.encode("utf-8")).decode("ascii"),
            "branch": branch,
        })
    return _gh("POST", "pulls", {"title": title, "head": branch, "base": BASE, "body": body})["html_url"]


def main() -> int:
    ap = argparse.ArgumentParser(description="승인한 규칙 후보를 카드 PR 로 올린다")
    ap.add_argument("--dry-run", action="store_true", help="GitHub 을 부르지 않고 카드와 PR 본문만 출력한다")
    args = ap.parse_args()
    if not args.dry_run and not settings.rules_pr_token:
        print("RULES_PR_TOKEN 이 없어 카드 PR 을 만들지 않았다")
        return 1

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        if not args.dry_run:
            sync(conn)

        files, rows = {}, []
        for r in conn.execute(_APPROVED).fetchall():
            cid, cat = r["id"], r["merchant_category"]
            if r["draft_yaml"] is None:
                print(f"  - #{cid} {cat} [건너뜀] 초안 없이 승인됐다")
                continue
            approved = r["reviewed_at"].astimezone(KST).date()
            try:
                text = finalize(r["draft_yaml"], cid, approved)
                card = yaml.safe_load(text)
            except (ValueError, yaml.YAMLError) as e:
                print(f"  - #{cid} {cat} [건너뜀] {e}")
                continue
            files[cid] = (card_path(cid, cat), text)
            rows.append(f"| #{cid} | `{card['id']}` | {cat} · {r['industry_code']} "
                        f"| {card['gate']} · {card.get('verdict') or '-'} | {approved} |")

        if not files:
            print("카드 PR 로 올릴 승인 후보 없음")
            return 0
        title = f"feat: 승인된 규칙 후보 {len(files)}건 카드 추가"
        body = "\n".join([
            "관리자 화면에서 승인한 규칙 후보를 카드로 옮겼다. `pipeline.promote` 가 만든 PR 이다.",
            "",
            "| 후보 | 카드 | 카테고리 · 업종 | 관문 · 결론 | 승인일 |",
            "|---|---|---|---|---|",
            *rows,
            "",
            "- 효력 시작일은 승인일이다(소급하지 않는다).",
            "- CI(RuleCardLoader · EvalHarnessTest)가 초록이면 머지한다.",
            "- 카드 하나를 빼려면 그 파일을 지우고 머지한다. 다음 실행이 그 후보를 대기로 되돌린다.",
            "- PR 을 닫으면 들어 있던 후보가 모두 대기로 돌아간다.",
        ])
        if args.dry_run:
            for path, text in files.values():
                print(f"--- {path}\n{text}")
            print(f"--- PR: {title}\n{body}")
            return 0

        url = open_pr(files, title, body)
        conn.execute("UPDATE rule_candidate SET pr_url = %s WHERE id = ANY(%s)", (url, list(files)))
        print(f"카드 PR {url} ({len(files)}건)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
