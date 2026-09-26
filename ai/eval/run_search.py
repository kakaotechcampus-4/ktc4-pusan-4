"""검색 골든셋 하네스. 청킹·검색 전략을 A/B 로 재는 자다.

사용: python -m eval.run_search [--k 8] [--case RC-004] [--rewrite]

두 층을 잰다.

  기본      golden.yaml 의 고정 질의 -> search      검색만. 모델 호출 0회
  --rewrite pipeline.query.rewrite() -> search      에이전트 경로까지

기본을 고정 질의로 둔 이유는 원인 귀속이다. 매번 모델이 질의를 새로 쓰면
0/10 이 나와도 검색이 깨진 건지 프롬프트가 나쁜 건지 구분할 수 없다.
청킹·RRF·필터를 건드릴 때는 기본으로 재고, 프롬프트를 손볼 때만 --rewrite 를 쓴다.

채점은 랭킹된 청크 본문으로 한다. 조 전문으로 넓힌 본문으로 채점하면 9호와
13호가 같은 조에 있어 RC-007 의 must_not 이 구조적으로 깨진다.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from datetime import date
from pathlib import Path

import yaml

from pipeline.embed import embed
from pipeline.query import SearchPlan, category_meta, rewrite
from pipeline.search import SKIP_SECTIONS, TIERS, Hit, connect, search_tiers

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

GOLDEN = Path(__file__).parent / "golden.yaml"

# 귀속연도. 골든셋 기대값이 현행 조문 기준이다.
AS_OF = date(2026, 1, 1)

# 골든셋 stop_at 표기를 doc_type 값으로 옮긴다.
_TIER_OF = {"법령": "법령", "행정규칙": "행정규칙", "심판례·해석": "심판례해석", "판례": "판례"}


CACHE = Path(__file__).parent / ".queries.json"


def plan_of(case: dict, meta: dict, cache: dict, use_llm: bool) -> SearchPlan:
    """고정 질의를 쓰거나, 에이전트에게 검색 계획을 받아온다.

    에이전트 경로는 한 번 부르고 캐시한다. 검색 자체가 결정론이라 질의만
    고정하면 하네스도 재현된다.
    """
    if not use_llm:
        return SearchPlan(queries=[case["query"]], keywords=case.get("keywords") or [])

    i = case["input"]
    key = f"{i['merchant_category']}|{i['industry_code']}|{i['reason']}"
    if key not in cache:
        plan = rewrite(i["merchant_category"], i["industry_code"], i["reason"], meta)
        cache[key] = plan.model_dump()
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return SearchPlan(**cache[key])


def _key(want: dict) -> tuple[str, str]:
    return want["statute_id"], want["must_contain"]


def _matches(hits: list[Hit], want: dict) -> bool:
    """기대 조문은 조·항·호가 섞여 있고 색인은 맨 아래 조항만 한다.

    시행령 제67조를 기대해도 색인에는 그 아래 18개 청크만 있으므로 하위까지
    인정한다. must_contain 이 엉뚱한 하위 조항을 걸러주는 자물쇠다.
    """
    sid = want["statute_id"]
    return any(
        (h.statute_id == sid or h.statute_id.startswith(f"{sid}-"))
        and want["must_contain"] in h.body
        for h in hits
    )


_RANK = """
SELECT rnk FROM (
    SELECT statute_id, body, ROW_NUMBER() OVER (ORDER BY embedding <=> %(v)s::vector) AS rnk
      FROM legal_chunk
     WHERE doc_type = %(tier)s AND (section IS NULL OR section <> ALL(%(skip)s))) t
 WHERE (statute_id = %(sid)s OR statute_id LIKE %(pre)s)
   AND position(%(mc)s in body) > 0
 ORDER BY rnk LIMIT 1
"""


def rank_of(conn, vectors: list[list[float]], tiers: list[str], want: dict) -> int | None:
    """정답 청크가 몇 위인지. 질의·위계를 통틀어 가장 좋은 순위를 쓴다.

    통과/실패보다 이 숫자가 조정에 쓸모 있다. 벡터 단독 순위라 RRF 결과와는
    다르지만, 키워드가 안 걸릴 때 무엇이 한계인지는 이쪽이 보여준다.
    """
    found = [
        row["rnk"]
        for v in vectors
        for tier in tiers
        if (
            row := conn.execute(
                _RANK,
                {
                    "v": str(v),
                    "tier": tier,
                    "skip": SKIP_SECTIONS,
                    "sid": want["statute_id"],
                    "pre": want["statute_id"] + "-%",
                    "mc": want["must_contain"],
                },
            ).fetchone()
        )
    ]
    return min(found) if found else None


def run(case: dict, k: int, meta: dict, cache: dict, use_llm: bool) -> dict:
    """stop_at 까지의 위계를 훑어 상위 k 를 모은다."""
    stop = case["stop_at"]
    tiers = TIERS if stop == "보류" else TIERS[: TIERS.index(_TIER_OF[stop]) + 1]

    plan = plan_of(case, meta, cache, use_llm)
    with connect() as conn:
        by_tier = search_tiers(conn, plan.queries, plan.keywords, AS_OF, k, tiers)
        hits = [h for tier_hits in by_tier.values() for h in tier_hits]
        vectors = embed(plan.queries)
        # RC-004 는 expect 와 must_not 의 statute_id 가 같다(한 심판례의 다른 섹션).
        # statute_id 만으로 키를 잡으면 서로 덮어쓴다.
        ranks = {_key(w): rank_of(conn, vectors, tiers, w) for w in case["expect"] + case["must_not"]}

    return {
        "id": case["id"],
        "plan": plan,
        "ranks": ranks,
        "found": [w for w in case["expect"] if _matches(hits, w)],
        "missed": [w for w in case["expect"] if not _matches(hits, w)],
        "violated": [w for w in case["must_not"] if _matches(hits, w)],
        "hits": hits,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="검색 골든셋 채점")
    ap.add_argument("--k", type=int, default=8, help="위계별 상위 k")
    ap.add_argument("--case", help="한 건만 (예: RC-004)")
    ap.add_argument("--show", action="store_true", help="실패 케이스의 상위 k 를 찍는다")
    ap.add_argument("--rewrite", action="store_true", help="고정 질의 대신 에이전트가 질의를 쓴다")
    ap.add_argument("--fresh", action="store_true", help="--rewrite 의 질의 캐시를 버린다")
    args = ap.parse_args()

    cases = yaml.safe_load(GOLDEN.read_text(encoding="utf-8"))
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]

    meta = category_meta()
    stored = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    cache = {} if args.fresh else stored
    results = [run(c, args.k, meta, cache, args.rewrite) for c in cases]
    hallucinated = sum(len(r["violated"]) for r in results)
    want = sum(len(r["found"]) + len(r["missed"]) for r in results)
    got = sum(len(r["found"]) for r in results)

    print(f"{'id':<8} {'재현율':<9} {'must_not':<9} 비고")
    for r in results:
        n = len(r["found"]) + len(r["missed"])
        recall = f"{len(r['found'])}/{n}" if n else "—(음성)"
        bad = "위반" if r["violated"] else "ok"
        note = ", ".join(
            f"{w['statute_id']}({r['ranks'].get(_key(w)) or '없음'}위)"
            for w in r["missed"] + r["violated"]
        )
        print(f"{r['id']:<8} {recall:<9} {bad:<9} {note}")
        print(f"{'':<8} 질의: {' / '.join(r['plan'].queries)}")
        print(f"{'':<8} 키워드: {' / '.join(r['plan'].keywords) or '(없음)'}")

    print(f"\n재현율 {got}/{want}   환각(must_not 위반) {hallucinated}건")

    if args.show:
        for r in results:
            if not (r["missed"] or r["violated"]):
                continue
            print(f"\n── {r['id']} 상위 {args.k} ──")
            for h in sorted(r["hits"], key=lambda x: -x.score)[: args.k]:
                sec = f"/{h.section}" if h.section else ""
                print(f"  {h.score:.5f} {h.statute_id}{sec}  {h.body[:60].strip()}")

    # 환각이 재현율보다 먼저다. 없는 근거를 지어내는 건 못 찾는 것보다 나쁘다.
    return 1 if hallucinated else 0


if __name__ == "__main__":
    sys.exit(main())
