"""평가셋 만들기 -> data/testset.jsonl

  res     상권정보 전국. 키워드룰 미적중 + Plaid 미확정(전국 동명 1곳, 또는 최다 카테고리 비율 < 0.9).
          분류기가 Plaid 흐름 끝에서 실제로 받을 몫이다. dev 100 / test 500
  kwonly  상권정보 전국. 키워드룰 미적중 + Plaid 확정. test 100.
          지금 백엔드에는 상권정보 단계가 없어 이것도 분류기로 간다
  repo    레포 라벨(판정 평가셋 · 해외결제 평가셋 · 키워드룰 test_cases). 상권정보에 없는 온라인 · 해외 · 공공 몫

    SANGKWON_DIR=<상권정보 폴더> python tools/exp_decision_cls/build_testset.py

상권정보는 공개 데이터라 이 평가셋에는 개인 지출이 없다. 그래도 data/ 는 커밋하지 않는다(용량).
"""
from __future__ import annotations

import csv
import json
import random
import sys
import time
from collections import Counter, defaultdict

import yaml
from common import CATEGORIES, DATA, ROOT, TESTSET, load_module

mm = load_module("mm_common", ROOT / "tools" / "exp_merchant_match" / "common.py")
kwmod = load_module("keyword_rules", ROOT / "tools" / "keyword_rules.py")
nz = load_module("normalize", ROOT / "tools" / "normalize.py")
pg_block = load_module("pg_block", ROOT / "tools" / "pg_block.py")

SEED = 42
N_RES, N_RES_DEV, N_KWONLY = 600, 100, 100
POOL = 300      # 카테고리별 저수지. 키워드룰 필터 전에 넉넉히 뽑는다
CONFIRM = 0.9   # Plaid 자동 확정 비율 (docs/merchant_matching_eval.md)
csv.field_size_limit(1 << 24)


def load_mapping():
    """Plaid 비율 계산에는 전체 매핑을, 정답 라벨에는 ★검토 행을 뺀 매핑을 쓴다."""
    every, label = {}, {}
    with open(mm.MAPPING, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            every[r["소분류"]] = r["카테고리"]
            if "★" not in (r.get("비고") or ""):
                label[r["소분류"]] = r["카테고리"]
    return every, label


def rows():
    for path in mm.sangkwon_files():
        with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
            yield from csv.DictReader(f)


def build_index(every):
    """normkey(상호명) -> 카테고리(1곳) | Counter(여러 곳)."""
    idx = {}
    for rec in rows():
        k = mm.normkey((rec.get("상호명") or "").strip())
        if len(k) < 2:
            continue
        cat = every.get(rec.get("상권업종소분류명"), "?")
        v = idx.get(k)
        if v is None:
            idx[k] = cat
        elif isinstance(v, str):
            idx[k] = Counter({v: 1}) + Counter({cat: 1})
        else:
            v[cat] += 1
    return idx


def plaid(v):
    if isinstance(v, str):
        return "single", 1.0
    n = sum(v.values())
    ratio = v.most_common(1)[0][1] / n
    return ("confirmed" if ratio >= CONFIRM else "ambiguous"), round(ratio, 3)


def sample_pools(idx, label_map, rng):
    """버킷(res · kwonly) × 카테고리별 저수지 표본(Algorithm R)."""
    pools = {"res": defaultdict(list), "kwonly": defaultdict(list)}
    seen = {"res": Counter(), "kwonly": Counter()}
    for rec in rows():
        label = label_map.get(rec.get("상권업종소분류명"))
        if label not in CATEGORIES:
            continue
        name = (rec.get("상호명") or "").strip()
        k = mm.normkey(name)
        if len(k) < 2:
            continue
        kind, ratio = plaid(idx[k])
        bucket = "kwonly" if kind == "confirmed" else "res"
        item = {"name": name, "branch": (rec.get("지점명") or "").strip(), "label": label,
                "sub": rec.get("상권업종소분류명"), "plaid": kind, "ratio": ratio}
        seen[bucket][label] += 1
        pool, n = pools[bucket][label], seen[bucket][label]
        if len(pool) < POOL:
            pool.append(item)
        else:
            j = rng.randrange(n)
            if j < POOL:
                pool[j] = item
    return pools, seen


def keyword_miss(raw, norm, pg, kw):
    """PG 차단 -> 키워드룰. 둘 다 못 잡으면 분류기로 간다."""
    r = kwmod.pipeline(raw, "", norm, pg, kw)
    return r["stage"] == "uncertain", r["stage"], r["norm"].string_norm


def allocate(avail: dict[str, int], total: int) -> dict[str, int]:
    """카테고리마다 같은 몫을 주되 모자라는 카테고리의 남는 몫을 나머지에 다시 나눈다."""
    take = dict.fromkeys(avail, 0)
    left = total
    while left > 0:
        open_ = [c for c in avail if take[c] < avail[c]]
        if not open_:
            break
        share = max(1, left // len(open_))
        for c in sorted(open_, key=lambda c: avail[c] - take[c]):
            add = min(share, avail[c] - take[c], left)
            take[c] += add
            left -= add
            if left == 0:
                break
    return take


def build_sangkwon(norm, pg, kw, rng):
    every, label_map = load_mapping()
    t0 = time.time()
    idx = build_index(every)
    print(f"  인덱스 {len(idx):,}키 ({time.time() - t0:.0f}초)")
    pools, seen = sample_pools(idx, label_map, rng)
    print(f"  후보 모집단 res {sum(seen['res'].values()):,} · kwonly {sum(seen['kwonly'].values()):,} "
          f"({time.time() - t0:.0f}초)")
    del idx

    out, used = [], set()
    for bucket, total in (("res", N_RES), ("kwonly", N_KWONLY)):
        kept = defaultdict(list)
        for label, pool in pools[bucket].items():
            rng.shuffle(pool)
            for it in pool:
                raw, _cut = mm.trunc20(it["name"] + it["branch"])
                miss, _stage, n = keyword_miss(raw, norm, pg, kw)
                if miss and raw not in used:
                    used.add(raw)
                    kept[label].append(it | {"raw": raw, "norm": n})
        take = allocate({c: len(v) for c, v in kept.items()}, total)
        for label in sorted(kept):
            chosen = kept[label][: take[label]]
            n_dev = round(len(chosen) * N_RES_DEV / N_RES) if bucket == "res" else 0
            for i, it in enumerate(chosen):
                out.append({"set": bucket, "split": "dev" if i < n_dev else "test", "source": "sangkwon",
                            "raw": it["raw"], "norm": it["norm"], "label": label, "sub": it["sub"],
                            "plaid": it["plaid"], "ratio": it["ratio"], "kw_miss": True})
    return out


def build_repo(norm, pg, kw):
    raw_items = []
    for p in sorted((ROOT / "eval" / "cases").glob("E-*.yaml")):
        t = (yaml.safe_load(p.read_text(encoding="utf-8")) or {}).get("거래") or {}
        raw_items.append(("eval_case", t.get("가맹점"), t.get("merchant_category")))
    overseas = ROOT / "tools" / "exp_overseas_saas" / "eval_set.json"
    for x in json.loads(overseas.read_text(encoding="utf-8")):
        raw_items.append(("overseas", x["descriptor"], x["label"]))
    spec = yaml.safe_load((ROOT / "rules" / "keyword_rules.yaml").read_text(encoding="utf-8"))
    for c in spec.get("test_cases") or []:
        raw_items.append(("kw_test", c["in"], c["out"]))

    out, used, dropped = [], set(), Counter()
    for source, raw, label in raw_items:
        raw = (raw or "").strip()
        if not raw or label not in CATEGORIES or raw in used:
            dropped["라벨 밖 · 중복 · 빈 값"] += 1
            continue
        miss, stage, n = keyword_miss(raw, norm, pg, kw)
        if stage == "pg":  # PG 차단은 분류기 앞에서 끝난다
            dropped["PG 차단"] += 1
            continue
        used.add(raw)
        out.append({"set": "repo", "split": "test", "source": source, "raw": raw, "norm": n,
                    "label": label, "kw_miss": miss})
    print(f"  repo 제외: {dict(dropped)}")
    return out


def main() -> int:
    rng = random.Random(SEED)
    norm, pg, kw = nz.load(), pg_block.load(), kwmod.load()
    print("상권정보")
    items = build_sangkwon(norm, pg, kw, rng)
    print("레포 라벨")
    items += build_repo(norm, pg, kw)
    for i, it in enumerate(items):
        it["id"] = f"{it['set']}-{i:04d}"

    DATA.mkdir(exist_ok=True)
    with TESTSET.open("w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")

    print(f"\n{TESTSET.relative_to(ROOT)}: {len(items)}건")
    by = Counter((it["set"], it["split"]) for it in items)
    for k in sorted(by):
        print(f"  {k[0]:<7} {k[1]:<5} {by[k]}")
    print("res 카테고리별:", dict(Counter(it["label"] for it in items if it["set"] == "res")))
    print("res Plaid:", dict(Counter(it["plaid"] for it in items if it["set"] == "res")))
    print("repo 키워드룰 미적중:", sum(it["kw_miss"] for it in items if it["set"] == "repo"),
          "/", sum(it["set"] == "repo" for it in items))
    return 0


if __name__ == "__main__":
    sys.exit(main())
