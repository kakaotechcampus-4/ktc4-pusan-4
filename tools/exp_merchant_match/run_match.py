#!/usr/bin/env python3
"""Plaid식 가맹점 매칭 대리 평가 — 조회.

상권정보 전체를 인덱스로 쓰고, 같은 데이터에서 2만 행을 뽑아 카드 문자열처럼 변형해 조회한다.
  변형      V0 상호명만 / V1 상호명+지점명 붙임 / V2 V1 을 EUC-KR 20바이트로 절단
  시나리오  IN 가게가 스냅샷에 있음 / OUT 그 행을 인덱스에서 뺌(스냅샷에 없는 가게)
  조건      전국 / 시도 앎
  매칭      정확 일치 -> (절단 시) 접두 확장 -> 최장 접두
  예측      매칭된 가게들의 최다 카테고리(소분류 -> mapping_940909.csv)
출력 data/rows.pkl -> score.py 로 채점. 실카드 적중률은 이 데이터로 잴 수 없다.
"""
import bisect, csv, os, pickle, random, time
from collections import Counter
from common import normkey, trunc20, keyword_patterns, sangkwon_files, MAPPING, OUT_DIR

N_TEST, SEED, TOTAL_ROWS = 20000, 42, 2_772_484
csv.field_size_limit(1 << 24)

KW = keyword_patterns()
CAT = {r["소분류"]: r["카테고리"] for r in csv.DictReader(open(MAPPING, encoding="utf-8-sig"))}

sidos, subs = {}, {}
def code(sido, sub):  # (시도, 소분류) -> int
    return sidos.setdefault(sido, len(sidos)) * 1000 + subs.setdefault(sub, len(subs))

t0 = time.time()
rng = random.Random(SEED)
p = N_TEST / TOTAL_ROWS * 1.1
idx, test = {}, []          # key -> int(1곳) | Counter
for f in sangkwon_files():
    with open(f, encoding="utf-8", errors="replace", newline="") as fh:
        for rec in csv.DictReader(fh):
            name = (rec.get("상호명") or "").strip()
            k = normkey(name)
            if len(k) < 2:
                continue
            c = code(rec.get("시도명", ""), rec.get("상권업종소분류명", ""))
            v = idx.get(k)
            if v is None:
                idx[k] = c
            elif isinstance(v, int):
                idx[k] = Counter([v, c])
            else:
                v[c] += 1
            if rng.random() < p:
                test.append((name, (rec.get("지점명") or "").strip(), k, c))
    print(os.path.basename(f), len(idx), f"{time.time()-t0:.0f}s", flush=True)

test = random.Random(SEED).sample(test, N_TEST)
keys = sorted(idx)
inv_sub = {v: k for k, v in subs.items()}


def cnt(k):
    v = idx.get(k)
    if v is None:
        return None
    return Counter({v: 1}) if isinstance(v, int) else v


def lookup(q, truncated):
    c = cnt(q)
    if c:
        return Counter(c), {q}, "exact"
    if truncated:
        i = bisect.bisect_left(keys, q)
        used = []
        while i < len(keys) and keys[i].startswith(q) and len(used) < 50:
            used.append(keys[i]); i += 1
        if used:
            agg = Counter()
            for k in used:
                agg.update(cnt(k))
            return agg, set(used), "prefix_expand"
    for L in range(len(q) - 1, 1, -1):
        c = cnt(q[:L])
        if c:
            return Counter(c), {q[:L]}, "longest_prefix"
    return None, set(), "miss"


rows = []
for name, branch, own_key, own_code in test:
    own_sido = own_code // 1000
    true_cat = CAT[inv_sub[own_code % 1000]]
    raw1 = name + branch
    raw2, tr = trunc20(name + (" " + branch if branch else ""))
    variants = {"V0": (normkey(name), False), "V1": (normkey(raw1), False), "V2": (normkey(raw2), tr)}
    # 잔여분: 전국에 1곳뿐 + 키워드룰 미적중 (분류기 실험의 잔여분과 같은 성격)
    resid = sum(cnt(own_key).values()) == 1 and not any(p.search(raw1) for p in KW)
    for vname, (q, truncated) in variants.items():
        base, used, stage = lookup(q, truncated) if len(q) >= 2 else (None, set(), "miss")
        for scen in ("IN", "OUT"):
            c = Counter(base) if base else Counter()
            if scen == "OUT" and own_key in used:
                c[own_code] -= 1
                c = +c
            for cond in ("전국", "시도"):
                cc = c if cond == "전국" else Counter({k: n for k, n in c.items() if k // 1000 == own_sido})
                bycat = Counter()
                for k, n in cc.items():
                    bycat[CAT[inv_sub[k % 1000]]] += n
                tot = sum(bycat.values())
                if tot == 0:
                    rows.append((vname, scen, cond, resid, "miss", 0, true_cat, None, 0.0, 0))
                    continue
                pred, n = bycat.most_common(1)[0]
                rows.append((vname, scen, cond, resid, stage, 1, true_cat, pred, n / tot, tot))

os.makedirs(OUT_DIR, exist_ok=True)
pickle.dump(rows, open(os.path.join(OUT_DIR, "rows.pkl"), "wb"))
print("done", len(rows), f"{time.time()-t0:.0f}s")
