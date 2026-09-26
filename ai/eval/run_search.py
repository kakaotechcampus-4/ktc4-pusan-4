"""검색 골든셋 하네스. 청킹·검색 전략을 A/B 로 재는 자다.

사용: python -m eval.run_search [--k 8] [--case RC-004] [--rewrite]

두 층을 잰다.

  기본      golden.yaml 의 고정 질의 -> search      검색만. 모델 호출 0회
  --rewrite pipeline.query.rewrite() -> search      에이전트 경로까지

기본을 고정 질의로 둔 이유는 원인 귀속이다. 매번 모델이 질의를 새로 쓰면
0/10 이 나와도 검색이 깨진 건지 프롬프트가 나쁜 건지 구분할 수 없다.
청킹·RRF·필터를 건드릴 때는 기본으로 재고, 프롬프트를 손볼 때만 --rewrite 를 쓴다.

채점은 모델에게 보여주는 후보로 한다. 법령은 조 단위로 뽑혀 형제 잎이 점수 0 으로
딸려 온다. expect 는 보여준 잎 전부로 인정하고 must_not 은 순위에 든(점수 > 0) 것만
센다 — 9호(RC-007 must_not)와 13호(RC-008 expect)가 같은 조라 형제까지 세면 구조적으로 깨진다.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from datetime import date
from pathlib import Path

import yaml

from pipeline.chunk import clean
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


def cached_plan(cat: str, industry: str, reason: str, meta: dict, cache: dict, path: Path) -> SearchPlan:
    """에이전트에게 검색 계획을 한 번 받아 path 에 캐시한다. run_draft 도 쓴다.

    검색 자체가 결정론이라 질의만 고정하면 하네스도 재현된다. dict 가 아닌 값은
    SearchPlan 이전의 옛 캐시라 다시 받는다.
    """
    key = f"{cat}|{industry}|{reason}"
    if not isinstance(cache.get(key), dict):
        cache[key] = rewrite(cat, industry, reason, meta).model_dump()
        path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return SearchPlan(**cache[key])


def plan_of(case: dict, meta: dict, cache: dict, use_llm: bool) -> SearchPlan:
    """고정 질의를 쓰거나, 에이전트에게 검색 계획을 받아온다."""
    if not use_llm:
        return SearchPlan(queries=[case["query"]], keywords=case.get("keywords") or [])
    i = case["input"]
    return cached_plan(i["merchant_category"], i["industry_code"], i["reason"], meta, cache, CACHE)


def _key(want: dict) -> tuple[str, str]:
    return want["statute_id"], want["must_contain"]


def _matches(hits: list[Hit], want: dict) -> bool:
    """기대 조문은 조·항·호가 섞여 있고 색인은 맨 아래 조항만 한다.

    시행령 제67조를 기대해도 색인에는 그 아래 18개 청크만 있으므로 하위까지
    인정한다. must_contain 이 엉뚱한 하위 조항을 걸러주는 자물쇠다. 골든셋은 원문
    문구 그대로 두고, 청크와 같은 정리(clean)를 걸어 대조한다.
    """
    sid, mc = want["statute_id"], clean(want["must_contain"])
    return any(
        (h.statute_id == sid or h.statute_id.startswith(f"{sid}-")) and mc in h.body
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
                    "mc": clean(want["must_contain"]),
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
        "violated": [w for w in case["must_not"] if _matches([h for h in hits if h.score > 0], w)],
        "hits": hits,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="검색 골든셋 채점")
    ap.add_argument("--k", type=int, default=8, help="위계별 상위 k (법령은 조 k 개)")
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
