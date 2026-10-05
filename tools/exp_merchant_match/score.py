#!/usr/bin/env python3
"""채점. (1) 카테고리 정확도  (2) 확정 조건 '같은 이름 가게들의 최다 카테고리 비율 >= t' 스윕."""
import os, pickle
from collections import defaultdict
from common import OUT_DIR

rows = pickle.load(open(os.path.join(OUT_DIR, "rows.pkl"), "rb"))
g = defaultdict(list)
for r in rows:
    g[(r[0], r[1], r[2], "전체")].append(r)
    if r[3]:
        g[(r[0], r[1], r[2], "잔여분")].append(r)

print("## 카테고리 정확도\n변형|시나리오|조건|집합|n|적중률|카테고리 정확도(적중)")
for k in sorted(g):
    rs = g[k]; h = [r for r in rs if r[5]]
    acc = sum(r[6] == r[7] for r in h) / max(1, len(h))
    print("|".join(map(str, k)), len(rs), f"{len(h)/len(rs):.3f}", f"{acc:.3f}", sep="|")

TS = [0.6, 0.8, 0.9, 0.95, 1.0]
print("\n## 확정 조건 스윕 (V2)\n시나리오|조건|집합|" + "|".join(f"t={t} 확정률/정확도" for t in TS))
for k in sorted(k for k in g if k[0] == "V2"):
    rs = g[k]; out = []
    for t in TS:
        c = [r for r in rs if r[5] and r[8] >= t]
        out.append(f"{len(c)/len(rs):.3f}/{sum(r[6] == r[7] for r in c)/max(1, len(c)):.3f}")
    print("|".join(k[1:]), *out, sep="|")
