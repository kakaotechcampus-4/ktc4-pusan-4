"""코퍼스 동기화 한 런의 변경 요약과 영향 카드를 디스코드로 보낸다.

corpus-sync.sh 의 마지막 단계다. 변경이 없거나 앞 단계가 실패해도 보낸다.
카드를 고치는 건 사람이다. 이 알림은 검토할 카드를 알려 주기만 한다.

사용:
    python -m pipeline.sync_report --since 2026-10-05T04:51:00Z --dry-run
"""

from __future__ import annotations

import argparse
import contextlib
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg
import yaml
from psycopg.rows import dict_row

from app.config import ROOT, settings

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

KST = ZoneInfo("Asia/Seoul")
# 디스코드 상한은 2,000자. 이모지가 두 글자로 세어질 수 있어 여유를 둔다
LIMIT = 1900
CARD_LIMIT = 700
CUT = "\n…(잘림)"

_NEW = """
SELECT sv.doc_type, sv.hierarchy, sv.title, sv.statute_id, sv.doc_no, sv.effective_from,
       EXISTS (SELECT 1 FROM statute_version p
                WHERE p.statute_id = sv.statute_id
                  AND p.effective_to = sv.effective_from) AS revised
  FROM statute_version sv
 WHERE sv.fetched_at >= %s
 ORDER BY sv.id
"""

# sweep 은 확인한 날로 닫는다. 개정으로 닫힌 행은 같은 날 시행하는 후속 행이 있다
_CLOSED = """
SELECT sv.doc_type, sv.title, sv.statute_id
  FROM statute_version sv
 WHERE sv.effective_to = %s
   AND NOT EXISTS (SELECT 1 FROM statute_version n
                    WHERE n.statute_id = sv.statute_id
                      AND n.effective_from = sv.effective_to)
"""

_CHUNKS = "SELECT count(*) AS n FROM legal_chunk WHERE indexed_at >= %s"


def collect(conn: psycopg.Connection, since: datetime, day: date) -> tuple[list, list, int]:
    new = conn.execute(_NEW, (since,)).fetchall()
    closed = conn.execute(_CLOSED, (day,)).fetchall()
    chunks = conn.execute(_CHUNKS, (since,)).fetchone()["n"]
    return new, closed, chunks


def cited(rules: Path) -> dict[str, set[str]]:
    """인용 조문 -> 그 조문을 인용하는 카드. 선택지 인용(question.options)까지 모은다."""
    out: dict[str, set[str]] = defaultdict(set)
    for f in sorted((rules / "cards").glob("R-*.yaml")):
        card = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        refs = list(card.get("citations") or [])
        for option in (card.get("question") or {}).get("options") or []:
            refs += option.get("citations") or []
        for c in refs:
            out[c["id"] if isinstance(c, dict) else c].add(f.stem)
    return dict(out)


def hit(cite: str, changed: str) -> bool:
    """인용 조문 자신이나 그 하위가 바뀌었나.

    상위는 보지 않는다. 조 본문은 항·호를 다 품어서 호 하나만 바뀌어도 조 행이 새로 생긴다.
    부모 문구만 바뀐 경우는 하위 해시가 그대로라 놓친다.
    """
    return changed == cite or changed.startswith(f"{cite}-")


def _cap(items: list[str], k: int, unit: str) -> str:
    shown = ", ".join(items[:k])
    return f"{shown} … 외 {len(items) - k}{unit}" if len(items) > k else shown


def _jo(statute_id: str, doc_type: str) -> str:
    # 법령은 {법령명}-{조}[-{항}[-{호}]], 행정규칙은 {규칙명}#{ID}-{조} 이다. 규칙명에는 - 가 섞일 수 있다
    jo = statute_id.rsplit("-", 1)[1] if doc_type == "행정규칙" else statute_id.split("-")[1]
    if jo == "전문":
        return jo
    head, _, branch = jo.partition("의")
    return f"제{head}조" + (f"의{branch}" if branch else "")


def _jo_order(label: str) -> list[int]:
    return [int(n) for n in re.findall(r"\d+", label)]


def _fence(lines: list[str], limit: int) -> str:
    body = "\n".join(lines)
    if len(body) > limit:
        body = body[: limit - len(CUT)] + CUT
    return f"```\n{body}\n```"


def _card_lines(new: list, closed: list, cards: dict[str, set[str]]) -> tuple[list[str], int]:
    changed: dict[str, set[str]] = defaultdict(set)
    for r in new:
        changed[r["statute_id"]].add(str(r["effective_from"]))
    gone = {r["statute_id"] for r in closed}

    revised, deleted, names = [], [], set()
    for cite, cards_of in sorted(cards.items()):
        listed = _cap(sorted(cards_of), 10, "장")
        dates = sorted({d for sid, ds in changed.items() if hit(cite, sid) for d in ds})
        if dates:
            revised.append(f"• {cite} [시행 {', '.join(dates)}] {listed}")
            names |= cards_of
        if any(hit(cite, sid) for sid in gone):
            deleted.append(f"• {cite} {listed}")
            names |= cards_of
    lines = ["수정된 조문 참조:", *(revised or ["없음"]), "삭제된 조문 참조:", *(deleted or ["없음"])]
    return lines, len(names)


def _statute_lines(doc_type: str, new: list, closed: list) -> list[str]:
    rows = [r for r in new if r["doc_type"] == doc_type]
    gone = [r for r in closed if r["doc_type"] == doc_type]
    if not rows and not gone:
        return []
    n_rev = sum(r["revised"] for r in rows)
    counts = f"개정 {n_rev} · 신설 {len(rows) - n_rev} · 삭제 {len(gone)}"
    lines = [f"{doc_type} {len(rows) + len(gone)}건 ({counts})"]
    groups: dict[tuple[str, str], set[str]] = defaultdict(set)
    for r in rows:
        groups[(r["title"], f"{r['effective_from']} 시행")].add(_jo(r["statute_id"], doc_type))
    for r in gone:
        groups[(r["title"], "삭제")].add(_jo(r["statute_id"], doc_type))
    for (title, tag), jos in sorted(groups.items()):
        lines.append(f"• {title} [{tag}] {_cap(sorted(jos, key=_jo_order), 8, '개')}")
    return lines


def _case_lines(new: list) -> list[str]:
    cases = [r for r in new if r["doc_type"] == "심판례해석"]
    if not cases:
        return []
    by: dict[str, list] = defaultdict(list)
    for r in cases:
        by[r["hierarchy"]].append(r)
    lines = [" · ".join(f"{h} +{len(rs)}" for h, rs in sorted(by.items()))]
    for h, rs in sorted(by.items()):
        lines += [f"• [{h}] {r['doc_no'] or ''} {r['title'][:40]}" for r in rs[:5]]
        if len(rs) > 5:
            lines.append(f"  … 외 {len(rs) - 5}건")
    return lines


def render(
    new: list, closed: list, chunks: int, cards: dict[str, set[str]], failed: list[str], day: date
) -> str:
    title = f"📚 법령 코퍼스 주간 동기화 · {day:%m/%d} ({'월화수목금토일'[day.weekday()]})"
    if failed:
        head = [f"{title} ⚠️ 일부 실패 — {', '.join(failed)} · journalctl -u ktc4-corpus.service"]
    else:
        head = [f"{title} ✅"]

    if cards:
        card_lines, n = _card_lines(new, closed, cards)
        head.append(f"🃏 영향 카드 {n}장 — 수동 검토 필요" if n else "🃏 영향 카드 없음")
        head.append(_fence(card_lines, CARD_LIMIT))
    else:
        head.append("⚠️ 카드 목록을 읽지 못함 (rules/cards)")

    changes = [
        *_statute_lines("법령", new, closed),
        *_statute_lines("행정규칙", new, closed),
        *_case_lines(new),
    ]
    if chunks:
        changes.append(f"재색인 {chunks:,}청크")
    prefix = "\n".join([*head, "📋 변경사항"]) + "\n"
    return prefix + _fence(changes or ["변경 없음"], LIMIT - len(prefix) - len("```\n\n```"))


def post(url: str, content: str) -> None:
    payload = {"content": content, "allowed_mentions": {"parse": []}, "flags": 4}
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        # 기본 Python-urllib User-Agent 는 디스코드 앞단에서 403 으로 막힌다
        headers={"Content-Type": "application/json", "User-Agent": "ktc4-corpus-sync"},
        method="POST",
    )
    urllib.request.urlopen(request, timeout=30).close()


def main() -> int:
    ap = argparse.ArgumentParser(description="코퍼스 동기화 결과를 디스코드로 요약")
    ap.add_argument("--since", required=True, type=datetime.fromisoformat, help="런 시작 시각(ISO, UTC)")
    ap.add_argument("--failed", default="", help="실패한 단계 이름, 공백으로 구분")
    ap.add_argument("--dry-run", action="store_true", help="출력만 하고 보내지 않는다")
    args = ap.parse_args()

    day = args.since.astimezone(KST).date()
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        new, closed, chunks = collect(conn, args.since, day)
    message = render(new, closed, chunks, cited(ROOT / "rules"), args.failed.split(), day)
    print(message)
    if settings.team_discord_webhook and not args.dry_run:
        post(settings.team_discord_webhook, message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
