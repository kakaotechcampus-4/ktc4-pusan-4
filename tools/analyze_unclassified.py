#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
미분류 상호 빈도 측정.

되묻기 세션 배치 크기와 T4 시드사전 대상 목록을 추정이 아니라 데이터로 정하기 위한
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
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import keyword_rules as kw  # noqa: E402
import normalize as nz  # noqa: E402
import pg_block  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_CSV = ROOT / "data" / "sample.csv"
DEFAULT_CSV = ROOT / "data" / "unclassified_ranking.csv"
DETAIL_CSV = ROOT / "data" / "unclassified_detail.csv"

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


def safe_key(key: str, anon) -> str:
    """norm_key 를 콘솔에 찍기 전에 익명화한다.

    bizno 트랙 키는 사업자번호 10자리, string 트랙 키는 정규화된 상호명이라
    둘 다 그대로 찍으면 안 된다.
    """
    if nz.BIZNO_PAT.fullmatch(key):
        return nz.mask_bizno(key)
    return anon.label(key)


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


# ── --detail : 1층(브랜드 경계) 기준을 쓰기 위한 재료 ────────────────────
# 분류를 막고 있는 이유로 묶는다. 판단은 하지 않는다 — 재료만 낸다.

CORP_PREFIX = re.compile(r"^\s*(\(주\)|㈜|\(유\)|주식회사|유한회사|재단법인|사단법인)\s*")
PAIRS = (("(", ")"), ("[", "]"), ("（", "）"))
# 절단 판정 바이트. detect_truncation 은 == 20 이라 19 는 절단으로 안 본다.
# 19 는 마지막 2바이트 문자가 깨져 버려진 흔적일 수 있어 "의심" 으로 둔다.
SUSPECT_BYTES = 19


def bare_name(s):
    """법인격 접두어를 뗀 이름. 대조군을 찾을 때 (주) 끼리 묶이는 것을 막는다."""
    return CORP_PREFIX.sub("", str(s)).strip()


def unclosed_bracket(s):
    """닫히지 않은 괄호 = 기계적으로 잡히는 절단 신호."""
    return any(s.count(a) > s.count(b) for a, b in PAIRS)


def find_peers(name, pool):
    """절단 복원 대조군. 한쪽이 다른 쪽의 앞부분이어야 한다.

    처음에는 앞 N 글자 공유로 찾았는데 '지에스더프레시'(슈퍼)와 '지에스25'(편의점)가
    묶였다. 같은 회사지만 브랜드가 달라 카테고리가 갈린다. 그래서 접두 일치로 바꿨다 —
    한쪽이 다른 쪽의 앞부분일 때만 대조군으로 본다.
    """
    a = bare_name(name)
    peers = []
    for other in pool:
        b = bare_name(other)
        if b == a or not a or not b:
            continue
        short, long = (a, b) if len(a) <= len(b) else (b, a)
        if len(short) >= 6 and long.startswith(short):
            peers.append(other)
    return sorted(set(peers))


def detail_rows(product, rows, norm, pg, rules):
    pool = {r["raw_merchant"] for r in rows}
    freq = collections.Counter(r["raw_merchant"] for r in product)
    amount = collections.Counter()
    for r in product:
        amount[r["raw_merchant"]] += int(r["amount"] or 0)

    out, seen = [], set()
    for r in product:
        m = r["raw_merchant"]
        if m in seen:
            continue
        seen.add(m)
        p = kw.pipeline(m, r.get("biz_no", ""), norm, pg, rules)
        # PG 블록도 분류가 아니라 되묻기로 가므로 판단 대상이다.
        if p["category"] is not None and p["stage"] != "pg":
            continue
        res = p["norm"]
        peers = find_peers(m, pool)
        out.append({
            "raw_merchant": m,
            "string_norm": res["string_norm"], "norm_key": res["norm_key"],
            "track": res["track"], "거래건수": freq[m], "합계금액": amount[m],
            "branch": res["branch"], "branch_raw": res["branch_raw"],
            "branch_blocked": len(res["branch_blocked"] or []),
            "is_truncated": res["is_truncated"], "enc_bytes": res["enc_bytes"],
            "닫히지않은괄호": unclosed_bracket(m),
            "biz_no유무": "O" if r.get("biz_no") else "X",
            "PG블록": p["stage"] == "pg",
            "대조군_수": len(peers), "대조군": " | ".join(peers),
        })

    by_norm = collections.defaultdict(set)
    for d in out:
        by_norm[d["string_norm"]].add(d["norm_key"])
    for d in out:
        d["그룹"] = group_of(d, by_norm)
    out.sort(key=lambda d: (-d["거래건수"], -d["합계금액"]))
    total = sum(d["거래건수"] for d in out)
    running = 0
    for i, d in enumerate(out, 1):
        running += d["거래건수"]
        d["순위"] = i
        d["누적커버리지"] = "%.1f%%" % (running * 100.0 / total) if total else "0%"
    return out


def group_of(d, by_norm):
    """A 브랜드 경계 / B 트랙 분기 / C PG / E 절단 / D 나머지."""
    if d["branch_blocked"]:
        return "A"
    if d["PG블록"]:
        return "C"
    if len(by_norm[d["string_norm"]]) > 1:
        return "B"
    # 20바이트는 확정. 19바이트는 대조군으로 복원이 확인될 때만.
    # 닫히지 않은 괄호는 바이트와 무관하게 절단 신호다.
    if d["is_truncated"] or d["닫히지않은괄호"]:
        return "E"
    if d["enc_bytes"] == SUSPECT_BYTES and d["대조군_수"]:
        return "E"
    return "D"


GROUP_LABEL = {
    "A": "브랜드 경계를 못 찾음 (branch_blocked)",
    "B": "사업자번호 트랙으로 갈림",
    "C": "PG 블록",
    "D": "키워드룰에 없는 상호",
    "E": "20바이트 절단",
}

DETAIL_FIELDS = ["순위", "그룹", "raw_merchant", "string_norm", "norm_key", "track",
                 "거래건수", "합계금액", "누적커버리지", "branch", "branch_raw",
                 "branch_blocked", "is_truncated", "enc_bytes", "닫히지않은괄호",
                 "biz_no유무", "PG블록", "대조군_수", "대조군"]


def print_detail(out, anon):
    """콘솔에는 상호명을 찍지 않는다. 집계만."""
    print("=== 미분류 상세 (제품 경로) — 상호 %d개 / 거래 %d건 ==="
          % (len(out), sum(d["거래건수"] for d in out)))
    for g in sorted(GROUP_LABEL):
        sel = [d for d in out if d["그룹"] == g]
        if sel:
            print("  %s  상호 %2d개 / 거래 %3d건 / %s원  — %s"
                  % (g, len(sel), sum(d["거래건수"] for d in sel),
                     format(sum(d["합계금액"] for d in sel), ","), GROUP_LABEL[g]))
    print()
    print("  enc_bytes 19~20 분포")
    for b in (19, 20):
        sel = [d for d in out if d["enc_bytes"] == b]
        if sel:
            print("    %dB  %d상호 (대조군 있음 %d)"
                  % (b, len(sel), sum(1 for d in sel if d["대조군_수"])))
    n = sum(1 for d in out if d["닫히지않은괄호"])
    print("  닫히지 않은 괄호: %d상호" % n)
    print()

def selftest_detail():
    """--detail 의 판정 로직만 검사한다. 데이터 없이 돈다."""
    assert bare_name("(주)신세계백화점센텀") == "신세계백화점센텀"
    assert bare_name("주식회사 에이앤에이") == "에이앤에이"
    assert unclosed_bracket("오엠씨푸드(중앙과학")
    assert not unclosed_bracket("넘버원(NO.1) 화로구")
    # 접두 일치여야 한다 — 같은 회사라도 브랜드가 다르면 대조군이 아니다
    assert find_peers("지에스더프레시", {"지에스25편의점"}) == []
    assert find_peers("(주)신세계백화점센텀", {"(주)우아한형제들"}) == []
    assert find_peers("넘버원 화로구", {"넘버원 화로구이집"}) == ["넘버원 화로구이집"]
    base = {"branch_blocked": 0, "PG블록": False, "string_norm": "x",
            "is_truncated": False, "닫히지않은괄호": False, "enc_bytes": 12,
            "대조군_수": 0}
    one = {"x": {"k"}}
    assert group_of(dict(base, branch_blocked=1), one) == "A"
    assert group_of(dict(base, PG블록=True), one) == "C"
    assert group_of(base, {"x": {"k1", "k2"}}) == "B"
    assert group_of(dict(base, is_truncated=True, enc_bytes=20), one) == "E"
    assert group_of(dict(base, enc_bytes=19, 닫히지않은괄호=True), one) == "E"
    # 19바이트만으로는 절단이 아니다. 대조군으로 확인돼야 한다.
    assert group_of(dict(base, enc_bytes=19), one) == "D"
    assert group_of(dict(base, enc_bytes=19, 대조군_수=1), one) == "E"
    assert group_of(base, one) == "D"
    # 키 분열 원인 분리 — 합성. 사업자번호가 다른 GS25 2점 + 사업자번호 없는 GS25 1점.
    # 키 3개이고, 트랙 분기(bizno+string)와 점포별 사업자번호(bizno 안 2개)가 둘 다 선다.
    class _FakeNorm:
        @staticmethod
        def normalize(raw, biz_no=""):
            return {"string_norm": "GS25", "branch_blocked": [],
                    "track": "bizno" if biz_no else "string",
                    "norm_key": biz_no or "GS25"}

    fake = [{"raw_merchant": "GS25a", "biz_no": "111-11-11111"},
            {"raw_merchant": "GS25b", "biz_no": "222-22-22222"},
            {"raw_merchant": "GS25c", "biz_no": ""}]
    km = measure_key_split(fake, _FakeNorm)
    assert len(km["split"]["GS25"]) == 3, km["split"]
    assert km["n_track"] == 1 and km["n_bizno"] == 1, km
    assert sorted(km["cause"]["GS25"]) == ["bizno", "track"]
    assert km["excess"] == 2
    # 사업자번호가 하나뿐이면 아무 원인도 서지 않는다
    km2 = measure_key_split(fake[:1], _FakeNorm)
    assert km2["split"] == {} and km2["n_track"] == 0 and km2["n_bizno"] == 0
    print("selftest_key_split ok")
    print("selftest_detail ok")

# ── 키 분열 지표 ────────────────────────────────────────────────────
# 미분류율은 키 분열을 못 본다. 같은 브랜드가 여러 norm_key 로 갈려도
# 각각 정상 분류되면 미분류 0 이다. 그래서 A(브랜드 경계)와 B(트랙 분기)가
# 실측에서 1건·0건으로 보였다 — 작아서가 아니라 지표가 안 봐서다.
#
# 되묻기는 norm_key 단위로 묶이므로, 키가 갈리면 같은 가맹점을 여러 번 묻는다.
# #22(트랙 분기)와 #35(브랜드 사전)의 효과를 재려면 이 숫자가 있어야 한다.

BLOCKED_CSV = ROOT / "data" / "branch_blocked.csv"


def measure_key_split(rows, norm):
    """string_norm -> norm_key 가 1:N 으로 갈리는 정도와, 그 원인.

    원인이 둘이고 고치는 사람이 다르다.
      track   트랙 분기 — 같은 상호가 bizno 키와 string 키를 동시에 가진다.
              사업자번호가 붙은 행과 안 붙은 행이 섞이면 생긴다 (이슈 #22).
      bizno   점포별 사업자번호 — bizno 트랙 안에서만 여러 키를 가진다.
              프랜차이즈 각 점포가 별개 사업자라 지점 수만큼 갈린다 (이슈 #35).
    한 string_norm 이 둘 다 해당할 수 있어 따로 센다.
    """
    keys = collections.defaultdict(set)          # sn -> {(track, key)}
    rowcnt = collections.Counter()
    blocked = set()
    for r in rows:
        res = norm.normalize(r["raw_merchant"], r.get("biz_no", ""))
        sn = res["string_norm"]
        keys[sn].add((res["track"], res["norm_key"]))
        rowcnt[sn] += 1
        if res["branch_blocked"]:
            blocked.add(r["raw_merchant"])

    split, cause = {}, {}
    for sn, tk in keys.items():
        if len(tk) < 2:
            continue
        tracks = {t for t, _ in tk}
        bizno_keys = {k for t, k in tk if t == "bizno"}
        c = []
        if len(tracks) > 1:
            c.append("track")
        if len(bizno_keys) > 1:
            c.append("bizno")
        split[sn] = tk
        cause[sn] = c

    return {
        "n_norm": len(keys),
        "split": split, "rowcnt": rowcnt, "cause": cause,
        "excess": sum(len(tk) - 1 for tk in keys.values()),
        "n_track": sum(1 for c in cause.values() if "track" in c),
        "n_bizno": sum(1 for c in cause.values() if "bizno" in c),
        "blocked_merchants": blocked,
    }


def print_key_split(label, m, anon):
    print("[%s]" % label)
    # 다른 string_norm 이 같은 사업자번호 키로 묶이기도 해서 전역 개수만으로는
    # 분열 규모를 못 읽는다. string_norm 단위로 센다.
    print("  string_norm %d개 / 그중 키가 갈린 것 %d개 (초과 키 %d개)"
          % (m["n_norm"], len(m["split"]), m["excess"]))
    print("  원인별  트랙 분기 %d개 (#22) / 점포별 사업자번호 %d개 (#35)"
          % (m["n_track"], m["n_bizno"]))
    print("  갈린 거래 %d건" % sum(m["rowcnt"][sn] for sn in m["split"]))
    for sn, tk in sorted(m["split"].items(), key=lambda kv: -m["rowcnt"][kv[0]]):
        print("    %-18s 키 %d개 / %d건  원인=%s"
              % (safe_key(sn, anon)[:18], len(tk), m["rowcnt"][sn],
                 ",".join(m["cause"][sn]) or "-"))
    # branch_blocked 는 위 분열에 안 잡힌다. 한 string_norm 이 여러 키로 갈리는 게
    # 아니라, 지점이 안 떨어져 string_norm 자체가 상호마다 달라지기 때문이다.
    print("  지점 미분리로 애초에 안 뭉친 상호: %d개 (위 분열에 안 잡힘)"
          % len(m["blocked_merchants"]))
    print()


BLOCKED_FIELDS = ["raw_merchant", "string_norm", "norm_key", "track", "category",
                  "거래건수", "합계금액", "branch", "branch_raw", "blocked_patterns",
                  "enc_bytes", "is_truncated", "source_card"]


def blocked_rows(rows, norm, pg, rules):
    """branch_blocked 전건. 미분류 목록은 이 중 분류 실패한 것만 보여준다."""
    freq = collections.Counter(r["raw_merchant"] for r in rows)
    amount = collections.Counter()
    for r in rows:
        amount[r["raw_merchant"]] += int(r["amount"] or 0)
    out, seen = [], set()
    for r in rows:
        m = r["raw_merchant"]
        if m in seen:
            continue
        res = norm.normalize(m, r.get("biz_no", ""))
        if not res["branch_blocked"]:
            continue
        seen.add(m)
        p = kw.pipeline(m, r.get("biz_no", ""), norm, pg, rules)
        out.append({
            "raw_merchant": m, "string_norm": res["string_norm"],
            "norm_key": res["norm_key"], "track": res["track"],
            "category": p["category"], "거래건수": freq[m], "합계금액": amount[m],
            "branch": res["branch"], "branch_raw": res["branch_raw"],
            "blocked_patterns": " | ".join(res["branch_blocked"]),
            "enc_bytes": res["enc_bytes"], "is_truncated": res["is_truncated"],
            "source_card": r["source_card"],
        })
    out.sort(key=lambda d: (-d["거래건수"], d["raw_merchant"]))
    return out

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(DEFAULT_CSV),
                    help="미분류 순위표 출력 경로 (기본: data/ — gitignore 대상)")
    ap.add_argument("--detail", nargs="?", const=str(DETAIL_CSV), default=None,
                    help="분류를 막는 이유별 상세표를 낸다 (기본: data/ — gitignore 대상)")
    ap.add_argument("--blocked", nargs="?", const=str(BLOCKED_CSV), default=None,
                    help="branch_blocked 전건을 CSV 로 (기본: data/ — gitignore 대상)")
    ap.add_argument("--selftest", action="store_true", help="--detail 판정 로직 검사")
    args = ap.parse_args()

    if args.selftest:
        selftest_detail()
        return 0

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
        print("    %s -> %s" % (anon.label(m), [safe_key(k, anon) for k in keys]))
    print("  다른 상호가 한 키로 묶임: %d개" % len(merged))
    for k, ms in sorted(merged.items()):
        print("    %s <- %s" % (safe_key(k, anon), ", ".join(anon.label(x) for x in ms)))
    print()

    print("=== 키 분열 (미분류율이 못 보는 지표) ===")
    print_key_split("전체 %d건" % len(rows), measure_key_split(rows, norm), anon)
    print_key_split("제품 경로 %d건" % len(product),
                    measure_key_split(product, norm), anon)

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

    if args.blocked:
        bl = blocked_rows(rows, norm, pg, rules)
        dst = Path(args.blocked)
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=BLOCKED_FIELDS)
            w.writeheader()
            w.writerows(bl)
        print()
        print("  branch_blocked %d상호 — 그중 분류 실패 %d상호"
              % (len(bl), sum(1 for d in bl if d["category"] is None)))
        print("지점 미분리 -> %s  (상호명 원문 포함. 커밋 금지)" % dst)

    if args.detail:
        rows_d = detail_rows(product, rows, norm, pg, rules)
        print()
        print_detail(rows_d, anon)
        dst = Path(args.detail)
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=DETAIL_FIELDS)
            w.writeheader()
            w.writerows({k: d[k] for k in DETAIL_FIELDS} for d in rows_d)
        print("상세표 -> %s  (상호명 원문 포함. 커밋 금지)" % dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
