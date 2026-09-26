"""초안 골든셋 하네스. 규칙 카드가 정답지다.

사용: python -m eval.run_draft [--limit 10] [--gate G2] [--category 카페] [--show]

run_search 가 검색 한 층을 잰다면 이쪽은 그 뒤 두 층을 잰다.

  집계행 -> 질의 -> 검색 -> 근거 선택 -> 초안
                    ^^^^    ^^^^^^^^^^^^^^^^^
                run_search      run_draft

자를 따로 만들지 않는다. rules/cards/*.yaml 47장이 사람이 조문을 보고 쓴 답이고,
카드의 match 가 그대로 입력(카테고리 × 업종)이 된다. 한 카테고리에 카드가 여럿인
경우가 7건 있어서(온라인쇼핑 = R-104 G2 + R-240·R-241 G4) 카드 묶음을 정답으로 본다.

eval/README.md 가 "기대값을 카드에서 뽑으면 자기가 자기를 채점한다"고 경고하는데,
여기서 재는 대상은 판정 엔진이 아니라 카드를 만드는 파이프라인이라 카드가 정답지인
게 맞다. 대신 verified: true 인 인용만 쓴다.

⚠️ CI 에 넣지 않는다. 모델을 후보당 3번 부르므로 결정론이 아니고, 빨간불이
   "100% 내가 깨뜨린 것"이 아니게 된다(CONTEXT.md 9.4). 프롬프트를 손볼 때 돌린다.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import yaml

from pipeline.draft import draft
from pipeline.query import category_meta, context, rewrite
from pipeline.search import connect, expand, search_tiers
from pipeline.select import needs_review, select

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "rules" / "cards"
CACHE = Path(__file__).parent / ".drafts.json"

AS_OF = date(2026, 1, 1)
REASON = "RULE_NOT_FOUND"

# 카드에 industry 가 없으면 전 업종용이다. 페르소나로 물어본다.
PERSONA = "940909"


def wanted() -> dict[tuple[str, str], dict]:
    """카드를 (카테고리, 업종)으로 묶는다. 키워드·금액으로만 매칭하는 카드는 뺀다.

    그런 카드는 카테고리를 입력으로 줄 수 없어 이 하네스가 재현할 수 없다.
    """
    out: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"cards": [], "gates": set(), "verdicts": set(), "cites": set()}
    )
    for f in sorted(CARDS.glob("R-*.yaml")):
        card = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        match = card.get("match") or {}
        industry = (match.get("industry") or [PERSONA])[0]
        for cat in match.get("category") or []:
            w = out[(cat, industry)]
            w["cards"].append(card["id"])
            w["gates"].add(card["gate"])
            if card.get("verdict"):
                w["verdicts"].add(card["verdict"])
            w["cites"] |= {
                c["id"] for c in (card.get("citations") or []) if c.get("verified") is True
            }
    return dict(out)


def _same(a: str, b: str) -> bool:
    """조·항·호 입도가 달라도 같은 조문으로 본다.

    카드는 소득세법시행령-67 을 인용하는데 색인은 그 아래 항·호뿐이라, 글자
    일치만 보면 맞춘 것도 놓친 것으로 센다.
    """
    return a == b or a.startswith(f"{b}-") or b.startswith(f"{a}-")


def grade_verdict(got: str | None, want: set[str]) -> str:
    """결론은 틀리는 방향이 비대칭이다.

    오탐은 뒤에서 되돌릴 카드가 없고 미탐은 확인필요로 떨어진다
    (docs/rule-card-fields.md). 그래서 같은 불일치라도 나눠 센다.
    """
    if not want:
        return "—"
    if got in want:
        return "일치"
    if got is None:
        return "비움"
    if got == "확인필요":
        return "보수적"
    if want == {"확인필요"}:
        return "과잉확정"
    return "반대"


def produce(conn, cat: str, industry: str, meta: dict) -> dict:
    """파이프라인 한 바퀴. 실패는 값으로 돌려준다 — 한 건에 하네스가 죽으면 안 된다."""
    block = context(cat, industry, REASON, meta)
    try:
        plan = rewrite(cat, industry, REASON, meta)
        by_tier = search_tiers(conn, plan.queries, plan.keywords, AS_OF)
        flat = [h for hs in by_tier.values() for h in hs]
        ev = select(block, by_tier, bodies=expand(conn, flat))
        card = draft(block, ev)
    except (ValueError, RuntimeError) as e:
        return {"error": str(e)[:90], "refs": [], "pool": [], "gate": None,
                "verdict": None, "hold": True}
    return {
        "error": None,
        "refs": [r.statute_id for r in ev.refs],
        # 후보 전체를 남긴다. 이게 없으면 근거를 못 맞춘 게 검색 탓인지 선택 탓인지
        # 구분이 안 된다 - 원인 귀속이 하네스를 둘로 나눈 이유다.
        "pool": sorted({h.statute_id for hits in by_tier.values() for h in hits}),
        "gate": card.gate,
        "verdict": card.verdict,
        "hold": needs_review(ev, by_tier) or not ev.sufficient,
    }


def score(got: dict, want: dict) -> dict:
    """놓친 근거를 두 갈래로 가른다.

    후보에 없었으면 검색이 못 찾은 것이고, 있었는데 안 골랐으면 선택이 놓친 것이다.
    합쳐서 세면 프롬프트를 고쳐야 할지 검색을 고쳐야 할지 알 수 없다.
    """
    refs, pool, cites = got["refs"], got.get("pool") or [], want["cites"]
    hit = [c for c in cites if any(_same(r, c) for r in refs)]
    rest = [c for c in cites if c not in hit]
    unpicked = [c for c in rest if any(_same(x, c) for x in pool)]
    return {
        "hit": len(hit),
        "want": len(cites),
        "unpicked": unpicked,
        "unfound": [c for c in rest if c not in unpicked],
        "stray": [r for r in refs if not any(_same(r, c) for c in cites)],
        "gate_ok": got["gate"] in want["gates"],
        "verdict": grade_verdict(got["verdict"], want["verdicts"]),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="초안 골든셋 채점")
    ap.add_argument("--limit", type=int, help="앞에서 N건만")
    ap.add_argument("--category", help="한 카테고리만")
    ap.add_argument("--gate", help="기대 게이트로 거른다 (예: G2)")
    ap.add_argument("--show", action="store_true", help="인용을 전부 찍는다")
    ap.add_argument("--fresh", action="store_true", help="캐시를 버리고 다시 부른다")
    args = ap.parse_args()

    keys = wanted()
    if args.category:
        keys = {k: v for k, v in keys.items() if k[0] == args.category}
    if args.gate:
        keys = {k: v for k, v in keys.items() if args.gate in v["gates"]}
    items = list(keys.items())[: args.limit]

    meta = category_meta()
    cache = {} if args.fresh or not CACHE.exists() else json.loads(CACHE.read_text("utf-8"))

    rows = []
    with connect() as conn:
        for (cat, industry), want in items:
            ck = f"{cat}|{industry}"
            if ck not in cache:
                cache[ck] = produce(conn, cat, industry, meta)
                CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), "utf-8")
            rows.append(((cat, industry), want, cache[ck], score(cache[ck], want)))

    print(f"{'카테고리':<14} {'게이트':<12} {'근거':<7} {'결론':<8} 비고")
    for (cat, _), want, got, s in rows:
        gate = f"{got['gate'] or '-'}{'' if s['gate_ok'] else ' /' + '·'.join(sorted(want['gates']))}"
        note = []
        if got["error"]:
            note.append(got["error"])
        if s["unfound"]:
            note.append(f"검색누락 {len(s['unfound'])}")
        if s["unpicked"]:
            note.append(f"선택누락 {len(s['unpicked'])}")
        if s["stray"]:
            note.append(f"오적용 {len(s['stray'])}건")
        if got["hold"]:
            note.append("보류")
        print(
            f"{cat:<14} {gate:<12} {s['hit']}/{s['want']:<5} {s['verdict']:<8} "
            f"{' · '.join(note)}  [{','.join(want['cards'])}]"
        )
        if args.show and got["refs"]:
            print(f"{'':<14} 인용: {', '.join(got['refs'])}")

    n = len(rows)
    gate_ok = sum(r[3]["gate_ok"] for r in rows)
    hit = sum(r[3]["hit"] for r in rows)
    need = sum(r[3]["want"] for r in rows)
    stray = sum(len(r[3]["stray"]) for r in rows)
    unfound = sum(len(r[3]["unfound"]) for r in rows)
    unpicked = sum(len(r[3]["unpicked"]) for r in rows)
    grades = defaultdict(int)
    for r in rows:
        grades[r[3]["verdict"]] += 1

    print(f"\n게이트 {gate_ok}/{n}   근거 적중 {hit}/{need} (검색누락 {unfound} · 선택누락 {unpicked})   오적용 {stray}건")
    print("결론  " + "  ".join(f"{k} {v}" for k, v in sorted(grades.items())))

    # 반대 결론이 제일 나쁘다. 카드가 가능이라는데 초안이 불가면 경비를 잃는다.
    return 1 if grades["반대"] else 0


if __name__ == "__main__":
    sys.exit(main())
