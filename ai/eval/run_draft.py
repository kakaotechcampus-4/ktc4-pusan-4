"""초안 골든셋 하네스. 규칙 카드가 정답지다.

사용: python -m eval.run_draft [--limit 10] [--gate G2] [--category 카페] [--show] [--search-only]

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
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import yaml
from langfuse import observe

from eval.run_search import cached_plan
from pipeline.candidates import hold_reasons
from pipeline.draft import draft
from pipeline.query import category_meta, context
from pipeline.search import FRAME, connect, retrieve
from pipeline.select import _candidates, select

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "rules" / "cards"
CACHE = Path(__file__).parent / ".drafts.json"
# 질의 계획을 고정해 검색 쪽 지표를 결정적으로 만든다. 다시 쓰려면 이 파일을 지운다.
# run_search 의 .queries.json 과 나눈 건 거기 --fresh 가 파일을 통째로 덮기 때문이다.
PLANS = Path(__file__).parent / ".plans.json"

AS_OF = date(2026, 1, 1)
REASON = "RULE_NOT_FOUND"

# 카드에 industry 가 없으면 전 업종용이다. 페르소나로 물어본다.
PERSONA = "940909"


def wanted() -> dict[tuple[str, str], dict]:
    """카드를 (카테고리, 업종)으로 묶는다. 키워드·금액으로만 매칭하는 카드는 뺀다.

    그런 카드는 카테고리를 입력으로 줄 수 없어 이 하네스가 재현할 수 없다.
    휴일 카드(match.holiday)도 뺀다. 입력에 날짜가 없어서, 같은 카테고리의 평일 카드와
    섞이면 정답 판정이 {확인필요, 불가} 처럼 서로 반대인 값이 된다.
    """
    out: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"cards": [], "gates": set(), "verdicts": set(), "cites": set()}
    )
    for f in sorted(CARDS.glob("R-*.yaml")):
        card = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        match = card.get("match") or {}
        if match.get("holiday") is True:
            continue
        industry = (match.get("industry") or [PERSONA])[0]
        # 답마다 근거가 다르면 카드는 인용을 선택지에 둔다(docs/rule-card-fields.md). 그것도 정답이다.
        options = (card.get("question") or {}).get("options") or []
        cites = {
            c["id"]
            for c in (card.get("citations") or []) + [c for o in options for c in o.get("citations") or []]
            if c.get("verified") is True
        }
        for cat in match.get("category") or []:
            w = out[(cat, industry)]
            w["cards"].append(card["id"])
            w["gates"].add(card["gate"])
            if card.get("verdict"):
                w["verdicts"].add(card["verdict"])
            w["cites"] |= cites
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


@observe()
def produce(conn, cat: str, industry: str, meta: dict, plans: dict, search_only: bool = False) -> dict:
    """파이프라인 한 바퀴. 실패는 값으로 돌려준다 — 한 건에 하네스가 죽으면 안 된다."""
    block = context(cat, industry, REASON, meta)
    # 후보 전체를 남긴다. 이게 없으면 근거를 못 맞춘 게 검색 탓인지 선택 탓인지
    # 구분이 안 된다 - 원인 귀속이 하네스를 둘로 나눈 이유다. 선택이 실패해도 남긴다.
    out = {"error": None, "refs": [], "pool": [], "chars": 0, "gate": None, "verdict": None, "hold": True}
    try:
        plan = cached_plan(cat, industry, REASON, meta, plans, PLANS)
        by_tier = retrieve(conn, plan.queries, plan.keywords, AS_OF)
        out["pool"] = sorted({h.statute_id for hs in by_tier.values() for h in hs})
        out["chars"] = len(_candidates(by_tier))
        if search_only:
            return out
        ev = select(block, by_tier)
        card = draft(block, ev)
    except (ValueError, RuntimeError) as e:
        return out | {"error": str(e)[:90]}
    return out | {
        "refs": [r.statute_id for r in ev.refs],
        "evidence": ev.model_dump(),
        "gate": card.gate,
        "verdict": card.verdict,
        "hold": bool(hold_reasons(conn, ev, by_tier)),
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


def missing(got: dict, want: dict) -> list[str]:
    return [c for c in sorted(want["cites"]) if not any(_same(p, c) for p in got["pool"])]


def _base(c: str) -> bool:
    return any(_same(c, f) for f in FRAME)


def recall(rows: list) -> str:
    """후보에 정답 인용이 들어왔나. 기본 조문(27·33조)은 검색 없이 늘 붙으니 따로 센다."""
    seen = []
    for r in rows:
        miss = missing(r[2], r[1])
        seen += [(_base(c), c not in miss) for c in r[1]["cites"]]
    part = {b: [ok for f, ok in seen if f is b] for b in (True, False)}
    chars = sum(r[2].get("chars", 0) for r in rows) / max(len(rows), 1) / 1000
    return (
        f"그 외 조문 후보 재현율 {sum(part[False])}/{len(part[False])}"
        f" (기본 조문 {sum(part[True])}/{len(part[True])}) · 후보 평균 {chars:.1f}k자"
    )


def _of(rows: list, pred) -> str:
    return f"{sum(1 for r in rows if pred(r))}/{len(rows)}"


def summary(rows: list) -> list[str]:
    """판정 기준표(docs/rag-eval.md §2). 오류 키는 결론·G1·근거의 분모에서 뺀다.

    오류 키는 결론도 인용도 비어 있어서, 분모에 넣으면 오류가 늘 때 숫자가 좋아지거나 나빠진다.
    """
    ok = [r for r in rows if not r[2]["error"]]
    ask = [r for r in ok if r[1]["verdicts"] == {"확인필요"}]
    sure = [r for r in ok if r[1]["verdicts"] & {"가능", "불가"}]
    one = [r for r in sure if "확인필요" not in r[1]["verdicts"]]
    risky = [r for r in ok if r[3]["verdict"] in ("과잉확정", "반대")]
    g1 = [r for r in ok if "G1" in r[1]["gates"]]
    no_g1 = [r for r in ok if "G1" not in r[1]["gates"]]
    odd = [
        f"{r[0][0]} {r[2]['gate']}/{'·'.join(sorted(r[1]['gates']))}"
        for r in no_g1
        if not r[3]["gate_ok"] and r[2]["gate"] != "G1"
    ]

    hits, totals, strays = Counter(), Counter(), Counter()
    for r in ok:
        missed = {*r[3]["unfound"], *r[3]["unpicked"]}
        for c in r[1]["cites"]:
            totals[c] += 1
            hits[c] += c not in missed
        strays.update(r[3]["stray"])
    base = [c for c in totals if _base(c)]
    other = [c for c in totals if not _base(c)]
    unfound = sum(not _base(c) for r in ok for c in r[3]["unfound"])
    unpicked = sum(not _base(c) for r in ok for c in r[3]["unpicked"])
    top = max(ok, key=lambda r: len(r[3]["stray"]), default=None)

    return [
        (
            f"결론  과잉확정 {_of(ask, lambda r: r[3]['verdict'] == '과잉확정')}"
            f" · 반대 {_of(sure, lambda r: r[3]['verdict'] == '반대')}"
            f" · 확정 적중 {_of(one, lambda r: r[3]['verdict'] == '일치')}"
        ),
        (
            f"보류  위험 결론 중 {_of(risky, lambda r: r[2]['hold'])} · 전체 {_of(rows, lambda r: r[2]['hold'])}"
            f" (오류 {len(rows) - len(ok)} · 결론이 맞는데 보류 {sum(r[2]['hold'] and r[3]['verdict'] == '일치' for r in ok)})"
        ),
        f"G1    오판 {_of(no_g1, lambda r: r[2]['gate'] == 'G1')} · 적중 {_of(g1, lambda r: r[2]['gate'] == 'G1')}"
        + (f" · 그 밖의 게이트 불일치 {', '.join(odd)}" if odd else ""),
        f"근거  기본 조문 {sum(hits[c] for c in base)}/{sum(totals[c] for c in base)}"
        f" · 그 외 조문 {sum(hits[c] for c in other)}/{sum(totals[c] for c in other)}"
        f" (검색누락 {unfound} · 선택누락 {unpicked})"
        f" · 키당 카드 밖 인용 {strays.total() / max(len(ok), 1):.2f}"
        + (f" (최다 {top[0][0]} {len(top[3]['stray'])})" if top and top[3]["stray"] else ""),
        "      정답 조문별 적중 " + " · ".join(f"{c} {hits[c]}/{n}" for c, n in totals.most_common(5)),
        "      카드 밖 인용 " + " · ".join(f"{c} {n}" for c, n in strays.most_common(5)),
        f"검색  {recall(rows)}",
        f"오류  {len(rows) - len(ok)}/{len(rows)}",
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description="초안 골든셋 채점")
    ap.add_argument("--limit", type=int, help="앞에서 N건만")
    ap.add_argument("--category", help="한 카테고리만")
    ap.add_argument("--gate", help="기대 게이트로 거른다 (예: G2)")
    ap.add_argument("--show", action="store_true", help="인용을 전부 찍는다")
    ap.add_argument("--fresh", action="store_true", help="초안 캐시를 버리고 다시 부른다. 질의 계획은 남는다")
    ap.add_argument("--search-only", action="store_true", help="질의·검색만 돌려 후보 재현율을 잰다")
    args = ap.parse_args()

    keys = wanted()
    if args.category:
        keys = {k: v for k, v in keys.items() if k[0] == args.category}
    if args.gate:
        keys = {k: v for k, v in keys.items() if args.gate in v["gates"]}
    items = list(keys.items())[: args.limit]

    meta = category_meta()
    plans = json.loads(PLANS.read_text("utf-8")) if PLANS.exists() else {}
    cache = {} if args.fresh or not CACHE.exists() else json.loads(CACHE.read_text("utf-8"))

    rows = []
    with connect() as conn:
        for (cat, industry), want in items:
            if args.search_only:
                rows.append(((cat, industry), want, produce(conn, cat, industry, meta, plans, True)))
                continue
            ck = f"{cat}|{industry}"
            if ck not in cache:
                cache[ck] = produce(conn, cat, industry, meta, plans)
                CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), "utf-8")
            rows.append(((cat, industry), want, cache[ck], score(cache[ck], want)))

    if args.search_only:
        for (cat, _), want, got in rows:
            miss = missing(got, want)
            note = got["error"] or " ".join(miss)
            print(f"{cat:<14} 후보 {len(want['cites']) - len(miss)}/{len(want['cites'])}  {note}")
        print(f"\n{recall(rows)}")
        return 0

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
            note.append(f"카드 밖 {len(s['stray'])}건")
        if got["hold"]:
            note.append("보류")
        print(
            f"{cat:<14} {gate:<12} {s['hit']}/{s['want']:<5} {s['verdict']:<8} "
            f"{' · '.join(note)}  [{','.join(want['cards'])}]"
        )
        if args.show and got["refs"]:
            print(f"{'':<14} 인용: {', '.join(got['refs'])}")

    print("\n" + "\n".join(summary(rows)))

    # 반대 결론이 제일 나쁘다. 카드가 가능이라는데 초안이 불가면 경비를 잃는다.
    return 1 if any(r[3]["verdict"] == "반대" for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
