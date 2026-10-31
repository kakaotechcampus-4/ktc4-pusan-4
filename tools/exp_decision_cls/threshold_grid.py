"""자동 확정 임계값 격자: '예 ≥ k 그리고 1등 신뢰도 ≥ t' 일 때만 확정한다. 캐시만 읽는다.

판은 NK(기타 제외 + 예/아니오)로 고정한다. 칸은 확정 비율 / 정밀도 (Wilson 95% 하한) · 오분류 중 판정 전이 / →가능.

    python tools/exp_decision_cls/threshold_grid.py
    python tools/exp_decision_cls/threshold_grid.py --split dev
    python tools/exp_decision_cls/threshold_grid.py --errors 0.99 1.0
"""
from __future__ import annotations

import argparse
import math
import sys

import common as c
import score as s

K = [0.5, 0.8, 0.9, 0.95, 0.99, 1.0]
T = [0.5, 0.8, 0.9, 0.95, 0.99, 1.0]


def wilson_lo(k: int, n: int, z: float = 1.96) -> float:
    p, d = k / n, 1 + z * z / n
    return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d


def confirmed(rows, k, t):
    return [(it, p) for it, p in rows if not p["refused"] and p["known"] >= k and p["confidence"] >= t]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", choices=["J", "L"], default="L")
    ap.add_argument("--split", choices=["dev", "test"], default="test")
    ap.add_argument("--errors", nargs=2, type=float, metavar=("K", "T"), help="이 칸에서 확정됐는데 틀린 건을 출력")
    args = ap.parse_args()

    c.CHOICES_VARIANT, c.ASK_KNOWN = "no_other", True
    cache = c.load_cache()
    verdict, _ = s.base_verdicts()
    model = c.arm_config(args.arm)["model"]
    slices = {"res": (["res"], False)}
    if args.split == "test":
        slices |= {"kwonly": (["kwonly"], False), "repo": (["repo"], False), "repo 키워드룰 미적중": (["repo"], True)}

    print(f"arm={args.arm} split={args.split} 판=NK")
    for name, (sets, kw_only) in slices.items():
        items = sorted(c.load_testset(sets, args.split), key=lambda it: it["id"])
        if kw_only:
            items = [it for it in items if it["kw_miss"]]
        preds = s.collect(args.arm, model, items, 1, 0, cache)[0]
        rows = [(it, preds[it["id"]]) for it in items if it["id"] in preds]

        print(f"\n### {name} (n={len(rows)})")
        print("| 예 ≥ k / 1등 ≥ t | " + " | ".join(str(t) for t in T) + " |")
        print("|---|" + "---|" * len(T))
        for k in K:
            cells = []
            for t in T:
                sel = confirmed(rows, k, t)
                if not sel:
                    cells.append("0%")
                    continue
                ok = sum(p["top1"] == it["label"] for it, p in sel)
                wrong = [(it, p) for it, p in sel if p["top1"] != it["label"]]
                flip = sum(verdict.get(p["top1"]) != verdict.get(it["label"]) for it, p in wrong)
                to_ok = sum(verdict.get(p["top1"]) == "가능" != verdict.get(it["label"]) for it, p in wrong)
                cells.append(f"{len(sel) / len(rows):.0%} / {ok / len(sel):.0%} ({wilson_lo(ok, len(sel)):.0%}) · {flip}/{to_ok}")
            print(f"| {k} | " + " | ".join(cells) + " |")

        if args.errors:
            k, t = args.errors
            sel = confirmed(rows, k, t)
            rest = [(it, p) for it, p in rows if (it, p) not in sel]
            print(f"\n예 ≥ {k} · 1등 ≥ {t}: 확정 {len(sel)}건, 되묻기 {len(rest)}건 "
                  f"(되묻기 top3 적중 {sum(it['label'] in p['top3'] for it, p in rest) / max(1, len(rest)):.2f})")
            for it, p in sel:
                if p["top1"] != it["label"]:
                    print(f"  오답 {it['raw']} [{it.get('sub') or it.get('source')}] 정답={it['label']} → {p['top1']} "
                          f"(판정 {verdict.get(it['label'])} → {verdict.get(p['top1'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
