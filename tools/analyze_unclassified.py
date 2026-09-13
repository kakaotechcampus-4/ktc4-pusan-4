#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
미분류 상호 빈도 측정.

되묻기 상한과 T4 시드사전 대상 목록을 추정이 아니라 데이터로 정하기 위한
분석 스크립트다. 기존 파이프라인은 건드리지 않고 import 만 해서 실제 분류
순서(PG 블록 -> 키워드룰)를 그대로 태운다.

분석용 스크립트가 제품 경로 동작을 바꾸면 측정값을 믿을 수 없게 된다.

사용:
    python tools/analyze_unclassified.py
    python tools/analyze_unclassified.py --csv data/unclassified_ranking.csv
"""

from __future__ import annotations

import argparse
import collections
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import keyword_rules as kw  # noqa: E402
import normalize as nz  # noqa: E402
import pg_block  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_CSV = ROOT / "data" / "sample.csv"
DEFAULT_CSV = ROOT / "data" / "unclassified_ranking.csv"

TOP_N = (5, 10, 15, 20, 30)
# 제품 경로: 사용자가 카드사에서 받아 올리는 파일.
# teammate 는 상호명 한 컬럼짜리 분석용 목록이라 제품 경로가 아니다.
PRODUCT_SOURCES = ("ibk", "kb")


def load_target_rows() -> list:
    """status=판정대상 행만 읽는다.

    취소상계·대상제외를 넣으면 분모가 커져 미분류율이 좋아 보이지만 왜곡이다.
    """
    if not SAMPLE_CSV.exists():
        sys.exit("data/sample.csv 가 없습니다. python tools/parse_card_xls.py 를 먼저 실행하세요.")
    with SAMPLE_CSV.open(encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("status") == "판정대상"]


def classify(rows: list, norm, pg, rules) -> list:
    return [(r, kw.pipeline(r["raw_merchant"], r.get("biz_no", ""), norm, pg, rules))
            for r in rows]


def measure(results: list) -> dict:
    n = len(results)
    unc = [r for r, p in results if p["stage"] == "uncertain"]
    pgb = [r for r, p in results if p["stage"] == "pg"]
    freq = collections.Counter(r["raw_merchant"] for r in unc)
    total = sum(freq.values())

    cum, reach80 = {}, None
    running = 0
    for i, (_m, c) in enumerate(freq.most_common(), 1):
        running += c
        cum[i] = running / total * 100 if total else 0
        if reach80 is None and total and running / total >= 0.8:
            reach80 = (i, running, cum[i])

    return {
        "rows": n,
        "unclassified": len(unc),
        "unclassified_pct": len(unc) / n * 100 if n else 0,
        "unique_merchants": len(freq),
        "pg_rows": len(pgb),
        "pg_merchants": len({r["raw_merchant"] for r in pgb}),
        "classified_pct": (n - len(unc) - len(pgb)) / (n - len(pgb)) * 100 if n - len(pgb) else 0,
        "freq": freq,
        "cum": cum,
        "reach80": reach80,
    }


def diagnose_norm_key(unc_rows: list, norm) -> tuple:
    """같은 상호가 여러 norm_key 로 갈리는지 본다.

    갈리면 상호 단위 되묻기의 전제가 깨진다 — 사용자가 같은 가맹점에
    두 번 답하게 된다.
    """
    by_raw = collections.defaultdict(set)
    by_key = collections.defaultdict(set)
    for r in unc_rows:
        key = norm.normalize(r["raw_merchant"], r.get("biz_no", "")).norm_key
        by_raw[r["raw_merchant"]].add(key)
        by_key[key].add(r["raw_merchant"])
    split = {m: sorted(v) for m, v in by_raw.items() if len(v) > 1}
    merged = {k: sorted(v) for k, v in by_key.items() if len(v) > 1}
    return split, merged, len(by_key)


def print_cohort(label: str, m: dict) -> None:
    print("[%s]" % label)
    print("  행 %d / 미분류 %d건 (%.1f%%) / unique 상호 %d개"
          % (m["rows"], m["unclassified"], m["unclassified_pct"], m["unique_merchants"]))
    print("  PG 블록 %d건 / %d개 상호" % (m["pg_rows"], m["pg_merchants"]))
    print("  키워드룰 커버리지 %.1f%% (PG 제외 분모)" % m["classified_pct"])
    parts = []
    for i in TOP_N:
        parts.append("상위%d %s" % (
            i, ("%.1f%%" % m["cum"][i]) if i in m["cum"] else "전량(%d개)" % m["unique_merchants"]))
    print("  " + " / ".join(parts))
    if m["reach80"]:
        i, cnt, pct = m["reach80"]
        print("  누적 80%% 도달: 상위 %d개 상호 (%d건, %.1f%%)" % (i, cnt, pct))
    print()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(DEFAULT_CSV),
                    help="미분류 순위표 출력 경로 (기본: data/ — gitignore 대상)")
    args = ap.parse_args()

    norm, pg, rules = nz.load(), pg_block.load(), kw.load()
    rows = load_target_rows()
    product = [r for r in rows if r["source_card"] in PRODUCT_SOURCES]
    analysis = [r for r in rows if r["source_card"] not in PRODUCT_SOURCES]

    all_res = classify(rows, norm, pg, rules)
    print("=== 미분류 상호 빈도 (status=판정대상 %d건) ===" % len(rows))
    print()
    print_cohort("전체 %d건" % len(rows), measure(all_res))
    print_cohort("제품 경로 %d건 (ibk+kb)" % len(product), measure(classify(product, norm, pg, rules)))
    print_cohort("분석용 %d건 (teammate)" % len(analysis), measure(classify(analysis, norm, pg, rules)))

    unc_rows = [r for r, p in all_res if p["stage"] == "uncertain"]
    split, merged, n_keys = diagnose_norm_key(unc_rows, norm)
    print("=== norm_key 묶기 진단 (미분류 %d건) ===" % len(unc_rows))
    print("  unique raw_merchant %d개 -> unique norm_key %d개"
          % (len({r["raw_merchant"] for r in unc_rows}), n_keys))
    print("  같은 상호가 여러 키로 갈림: %d개" % len(split))
    anon = nz.Anon()
    for m, keys in sorted(split.items()):
        print("    %s -> %s" % (anon.label(m), keys))
    print("  다른 상호가 한 키로 묶임: %d개" % len(merged))
    for k, ms in sorted(merged.items()):
        print("    %s <- %s" % (k, ", ".join(anon.label(x) for x in ms)))
    print()

    out = Path(args.csv)
    out.parent.mkdir(parents=True, exist_ok=True)
    m_all = measure(all_res)
    product_freq = measure(classify(product, norm, pg, rules))["freq"]
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rank", "raw_merchant", "count", "cum_pct", "product_path_count"])
        running, total = 0, sum(m_all["freq"].values())
        for i, (mer, c) in enumerate(m_all["freq"].most_common(), 1):
            running += c
            w.writerow([i, mer, c, round(running / total * 100, 1) if total else 0,
                        product_freq.get(mer, 0)])
    # 상호명이 개인 지출 패턴을 드러내므로 레포에 커밋하지 않는다 (data/ 는 gitignore)
    print("순위표 -> %s  (상호명 원문 포함. 커밋 금지)" % out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
