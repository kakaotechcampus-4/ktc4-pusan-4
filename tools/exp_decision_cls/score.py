"""캐시만으로 채점한다(모델 호출 0회).

    python tools/exp_decision_cls/score.py --set res --split test
    python tools/exp_decision_cls/score.py --set res --split test --batch 30
    python tools/exp_decision_cls/score.py --set res --split test --limit 100 --repeat 3
    python tools/exp_decision_cls/score.py --set res --split dev --review 30

지표
  auto@pXX  정밀도 XX 를 지키며 자동 확정할 수 있는 비율. 신뢰도 동점은 한꺼번에 자른다. thr 은 그때의 기준값
  추천 적중  기준값(p95) 미만으로 미정이 된 건에서 1등이 정답인 비율. 결정 2번의 추천 버튼 품질이다
  판정 전이  자동 확정한 오분류 중 카테고리의 기본 판정(조건 없는 카드)이 바뀌는 건. '→가능' 은 경비로 잘못 통과하는 쪽
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import sys
from collections import Counter, defaultdict

import common as c

TARGETS = (0.90, 0.95)
# 1M 입력 토큰당 공급사 공시가(USD). 출력 토큰은 둘 다 0 이다. 게이트웨이 단가는 다를 수 있다.
#   J: TypeSafe 공시 0.042 · L: OpenAI Decisions API 보도 0.10
PRICE_PER_M = {"J": 0.042, "L": 0.10}


# ------------------------------------------------------------------ 판정 매핑
def base_verdicts() -> tuple[dict[str, str], set[str]]:
    ev = c.load_module("ev", c.ROOT / "tools" / "exp_category_cls" / "extract_category_verdict.py")
    base, conditional = defaultdict(set), set()
    for card in ev.load_cards():
        match = card.get("match") or {}
        extra = [k for k in match if k not in ev.CONTEXT_KEYS]
        for cat in match.get("category") or []:
            if extra:
                conditional.add(cat)
            else:
                base[cat].add(ev.outcome(card))
    return {k: ",".join(sorted(v)) for k, v in base.items()}, conditional


# ------------------------------------------------------------------ 예측 모으기
def collect(arm, model, items, batch, rep, cache):
    preds, recs, missing = {}, [], 0
    for g in c.batches(items, batch):
        rec = cache.get(c.cache_key(arm, c.build_body(arm, model, g), rep))
        if not rec or rec["status"] != 200:
            missing += len(g)
            continue
        recs.append(rec)
        for it, a in zip(g, c.parse_answers(arm, rec["payload"], len(g))):
            preds[it["id"]] = a
    return preds, recs, missing


# ------------------------------------------------------------------ 지표
def auto_at(correct, conf, target):
    pairs = sorted(zip(conf, correct), key=lambda x: -x[0])
    n, hit, cov, thr = len(pairs), 0, 0.0, None
    for i, (cf, ok) in enumerate(pairs):
        hit += ok
        if i + 1 < n and pairs[i + 1][0] == cf:
            continue
        if hit / (i + 1) >= target:
            cov, thr = (i + 1) / n, cf
    return cov, thr


def ece(correct, conf, bins=10):
    total, err = len(conf), 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        idx = [i for i, x in enumerate(conf) if lo <= x < hi or (b == bins - 1 and x == 1.0)]
        if idx:
            acc = sum(correct[i] for i in idx) / len(idx)
            avg = sum(conf[i] for i in idx) / len(idx)
            err += len(idx) / total * abs(acc - avg)
    return err


def pct(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, max(0, math.ceil(q * len(xs)) - 1))] if xs else float("nan")


def auroc(scores, labels):
    """맞힌 건의 점수가 틀린 건보다 높을 확률. 0.5 면 점수가 정답 여부를 못 가른다."""
    pos = [s for s, y in zip(scores, labels) if y]
    neg = [s for s, y in zip(scores, labels) if not y]
    if not pos or not neg:
        return float("nan")
    return sum((p > n) + 0.5 * (p == n) for p in pos for n in neg) / (len(pos) * len(neg))


def mcnemar(a, b):
    """정확 이항검정. a, b 는 같은 순서의 정답 여부."""
    x = sum(1 for p, q in zip(a, b) if p and not q)
    y = sum(1 for p, q in zip(a, b) if q and not p)
    n, k = x + y, min(x, y)
    if n == 0:
        return x, y, 1.0
    p = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return x, y, min(1.0, 2 * p)


def arm_metrics(arm, items, preds, recs, verdict, conditional):
    ids = [it["id"] for it in items if it["id"] in preds]
    label = {it["id"]: it["label"] for it in items}
    correct = [preds[i]["top1"] == label[i] for i in ids]
    conf = [preds[i]["confidence"] or 0.0 for i in ids]
    out = {"n": len(ids), "top1": sum(correct) / len(ids),
           "top3": sum(label[i] in preds[i]["top3"] for i in ids) / len(ids),
           "ece": ece(correct, conf)}
    for t in TARGETS:
        out[f"auto@p{int(t * 100)}"], out[f"thr@p{int(t * 100)}"] = auto_at(correct, conf, t)

    thr = out["thr@p95"]
    below = [i for i, cf in zip(ids, conf) if thr is None or cf < thr]
    out["미정"] = len(below)
    out["추천 적중"] = sum(preds[i]["top1"] == label[i] for i in below) / len(below) if below else float("nan")
    out["추천 top3"] = sum(label[i] in preds[i]["top3"] for i in below) / len(below) if below else float("nan")

    auto_wrong = [i for i, cf in zip(ids, conf) if thr is not None and cf >= thr and preds[i]["top1"] != label[i]]
    flips = [i for i in auto_wrong if verdict.get(preds[i]["top1"]) != verdict.get(label[i])]
    out["자동 오분류"] = len(auto_wrong)
    out["판정 전이"] = len(flips)
    out["→가능"] = sum(1 for i in flips if verdict.get(preds[i]["top1"]) == "가능")
    out["조건부 연루"] = sum(1 for i in auto_wrong if preds[i]["top1"] in conditional or label[i] in conditional)

    out["AUROC 신뢰도"] = auroc(conf, correct)
    out["거절"] = sum(preds[i]["refused"] for i in ids)
    known = [preds[i]["known"] for i in ids]
    if all(k is not None for k in known):
        prod = [cf * k for cf, k in zip(conf, known)]
        sure = [k >= 0.5 for k in known]
        out["AUROC 예/아니오"] = auroc(known, correct)
        out["AUROC 곱"] = auroc(prod, correct)
        out["auto@p95 곱"], out["thr@p95 곱"] = auto_at(correct, prod, 0.95)
        out["예≥0.5 비율"] = sum(sure) / len(ids)
        out["top1 | 예≥0.5"] = sum(ok for ok, sv in zip(correct, sure) if sv) / max(1, sum(sure))
        out["top1 | 예<0.5"] = sum(ok for ok, sv in zip(correct, sure) if not sv) / max(1, len(ids) - sum(sure))
        hit3 = [label[i] in preds[i]["top3"] for i in ids]
        out["top3 | 예≥0.5"] = sum(h for h, sv in zip(hit3, sure) if sv) / max(1, sum(sure))
        out["top3 | 예<0.5"] = sum(h for h, sv in zip(hit3, sure) if not sv) / max(1, len(ids) - sum(sure))
    for t in (0.9, 0.99, 1.0):
        sel = [ok for ok, cf in zip(correct, conf) if cf >= t]
        out[f"신뢰도≥{t}"] = f"{len(sel) / len(ids):.0%} / {sum(sel) / len(sel):.0%}" if sel else "0%"

    lat = [r["latency_ms"] for r in recs]
    tokens = [r["payload"].get("usage", {}).get("input_tokens", 0) / r["batch"] for r in recs]
    out["지연 p50"], out["지연 p95"] = pct(lat, 0.5), pct(lat, 0.95)
    out["토큰/건"] = statistics.mean(tokens) if tokens else float("nan")
    out["USD/1000건"] = out["토큰/건"] * 1000 * PRICE_PER_M[arm] / 1e6
    out["재시도"] = sum(1 for r in recs if r["attempts"] > 1)
    return out, ids, correct, conf


def bootstrap_diff(ca, fa, cb, fb, target=0.95, b=2000, seed=42):
    rng, n, diffs = random.Random(seed), len(ca), []
    for _ in range(b):
        s = [rng.randrange(n) for _ in range(n)]
        da = auto_at([ca[i] for i in s], [fa[i] for i in s], target)[0]
        db = auto_at([cb[i] for i in s], [fb[i] for i in s], target)[0]
        diffs.append(da - db)
    diffs.sort()
    return diffs[int(0.025 * b)], diffs[int(0.975 * b) - 1]


# ------------------------------------------------------------------ 출력
def fmt(v):
    if isinstance(v, float):
        return "—" if math.isnan(v) else (f"{v:.3f}" if abs(v) < 10 else f"{v:,.0f}")
    return "—" if v is None else str(v)


def table(rows: dict[str, dict], keys: list[str]):
    arms = list(rows)
    print("| 지표 | " + " | ".join(arms) + " |")
    print("|---|" + "---|" * len(arms))
    for k in keys:
        print(f"| {k} | " + " | ".join(fmt(rows[a].get(k)) for a in arms) + " |")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", nargs="+", default=["res"])
    ap.add_argument("--split", default="test")
    ap.add_argument("--batch", type=int, default=1)
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only-kw-miss", action="store_true", help="repo 에서 키워드룰 미적중만")
    ap.add_argument("--drop-other", action="store_true", help="정답이 기타인 건을 뺀다(기타 제외 판 비교용)")
    ap.add_argument("--labels", help="라벨 정정 jsonl ({id, label})")
    ap.add_argument("--review", type=int, default=0, help="두 팔이 같은 답인데 라벨과 다른 건을 N건 출력")
    args = ap.parse_args()

    items = sorted(c.load_testset(args.set, args.split), key=lambda it: it["id"])
    if args.only_kw_miss:
        items = [it for it in items if it["kw_miss"]]
    if args.drop_other:
        items = [it for it in items if it["label"] != "기타"]
    if args.limit:
        items = items[: args.limit]
    if args.labels:
        with open(args.labels, encoding="utf-8") as f:
            fix = {r["id"]: r["label"] for r in map(json.loads, f)}
        for it in items:
            it["label"] = fix.get(it["id"], it["label"])
    cache = c.load_cache()
    verdict, conditional = base_verdicts()
    models = {arm: c.arm_config(arm)["model"] for arm in ("J", "L")}
    variant = f"choices={c.CHOICES_VARIANT} known={int(c.ASK_KNOWN)} desc={c.DESC_VARIANT}"
    print(f"set={'+'.join(args.set)} split={args.split} batch={args.batch} {variant} 항목 {len(items)}건\n")

    if args.repeat > 1:
        for arm in ("J", "L"):
            runs = [collect(arm, models[arm], items, args.batch, r, cache)[0] for r in range(args.repeat)]
            ids = [it["id"] for it in items if all(it["id"] in p for p in runs)]
            flip = sum(len({p[i]["top1"] for p in runs}) > 1 for i in ids)
            spread = [max(p[i]["confidence"] for p in runs) - min(p[i]["confidence"] for p in runs) for i in ids]
            print(f"[{arm}] {len(ids)}건 × {args.repeat}회: 1등이 바뀐 건 {flip} ({flip / len(ids):.1%}), "
                  f"신뢰도 폭 평균 {statistics.mean(spread):.3f} · 최대 {max(spread):.3f}")
        return 0

    rows, raw, preds_by = {}, {}, {}
    for arm in ("J", "L"):
        preds, recs, missing = collect(arm, models[arm], items, args.batch, 0, cache)
        if not preds:
            print(f"[{arm}] 캐시에 결과가 없습니다")
            return 1
        metrics, ids, _correct, _conf = arm_metrics(arm, items, preds, recs, verdict, conditional)
        rows[arm], raw[arm] = metrics | {"누락": missing}, ids
        preds_by[arm] = preds

    keys = ["n", "누락", "거절", "top1", "top3", "auto@p90", "thr@p90", "auto@p95", "thr@p95", "ece", "AUROC 신뢰도",
            "신뢰도≥0.9", "신뢰도≥0.99", "신뢰도≥1.0",
            "미정", "추천 적중", "추천 top3", "자동 오분류", "판정 전이", "→가능", "조건부 연루"]
    if c.ASK_KNOWN:
        keys += ["AUROC 예/아니오", "AUROC 곱", "auto@p95 곱", "thr@p95 곱", "예≥0.5 비율",
                 "top1 | 예≥0.5", "top3 | 예≥0.5", "top1 | 예<0.5", "top3 | 예<0.5"]
    table(rows, keys + ["지연 p50", "지연 p95", "토큰/건", "USD/1000건", "재시도"])

    if c.CHOICES_VARIANT != "all" or c.ASK_KNOWN:
        # 기본 판(기타 포함 · 예/아니오 없음)에서 기타로 답했던 건이 어떻게 바뀌었나
        saved = c.CHOICES_VARIANT, c.ASK_KNOWN
        c.CHOICES_VARIANT, c.ASK_KNOWN = "all", False
        base = {arm: collect(arm, models[arm], items, args.batch, 0, cache)[0] for arm in ("J", "L")}
        c.CHOICES_VARIANT, c.ASK_KNOWN = saved
        lab = {it["id"]: it["label"] for it in items}
        print("\n기본 판에서 1등이 기타였던 건(정답은 기타 아님)")
        for arm in ("J", "L"):
            ids = [i for i, p in base[arm].items() if p["top1"] == "기타" and lab[i] != "기타" and i in preds_by[arm]]
            if not ids:
                continue
            new_ok = sum(preds_by[arm][i]["top1"] == lab[i] for i in ids) / len(ids)
            new_t3 = sum(lab[i] in preds_by[arm][i]["top3"] for i in ids) / len(ids)
            b_conf = statistics.mean(base[arm][i]["confidence"] for i in ids)
            n_conf = statistics.mean(preds_by[arm][i]["confidence"] for i in ids)
            hi = sum(preds_by[arm][i]["confidence"] >= 0.9 for i in ids) / len(ids)
            print(f"  [{arm}] {len(ids)}건: 새 1등 적중 {new_ok:.2f} · top3 {new_t3:.2f} · "
                  f"신뢰도 평균 {b_conf:.2f} → {n_conf:.2f} · 새 신뢰도 ≥0.9 비율 {hi:.0%}")

    # 쌍체 비교: 두 팔이 모두 답한 건만
    common_ids = [i for i in raw["J"] if i in preds_by["L"]]
    label = {it["id"]: it["label"] for it in items}
    ca = [preds_by["J"][i]["top1"] == label[i] for i in common_ids]
    cb = [preds_by["L"][i]["top1"] == label[i] for i in common_ids]
    fa = [preds_by["J"][i]["confidence"] or 0.0 for i in common_ids]
    fb = [preds_by["L"][i]["confidence"] or 0.0 for i in common_ids]
    x, y, p = mcnemar(ca, cb)
    lo, hi = bootstrap_diff(ca, fa, cb, fb)
    print(f"\n쌍체 {len(common_ids)}건 · top1 McNemar: J만 맞음 {x}, L만 맞음 {y}, p={p:.3f}")
    print(f"auto@p95 차이(J−L) {rows['J']['auto@p95'] - rows['L']['auto@p95']:+.3f}, 부트스트랩 95% 구간 [{lo:+.3f}, {hi:+.3f}]")

    if args.batch > 1:
        for arm in ("J", "L"):
            single, _, _ = collect(arm, models[arm], items, 1, 0, cache)
            both = [i for i in preds_by[arm] if i in single]
            if both:
                agree = sum(preds_by[arm][i]["top1"] == single[i]["top1"] for i in both) / len(both)
                acc1 = sum(single[i]["top1"] == label[i] for i in both) / len(both)
                accb = sum(preds_by[arm][i]["top1"] == label[i] for i in both) / len(both)
                print(f"[{arm}] 1건씩 대비: 1등 일치 {agree:.1%}, top1 {acc1:.3f} → {accb:.3f} ({len(both)}건)")

    print("\n카테고리별 top1")
    per = defaultdict(lambda: Counter())
    for i in common_ids:
        per[label[i]]["n"] += 1
        per[label[i]]["J"] += preds_by["J"][i]["top1"] == label[i]
        per[label[i]]["L"] += preds_by["L"][i]["top1"] == label[i]
    print("| 라벨 | n | J | L |\n|---|---|---|---|")
    for lab in sorted(per):
        s = per[lab]
        print(f"| {lab} | {s['n']} | {s['J'] / s['n']:.2f} | {s['L'] / s['n']:.2f} |")

    for arm in ("J", "L"):
        conf_pairs = Counter((label[i], preds_by[arm][i]["top1"]) for i in common_ids
                             if preds_by[arm][i]["top1"] != label[i])
        print(f"\n[{arm}] 자주 틀린 쌍(라벨 → 예측): " + ", ".join(f"{a}→{b} {n}" for (a, b), n in conf_pairs.most_common(8)))

    if args.review:
        by_id = {it["id"]: it for it in items}
        agree = [i for i in common_ids if preds_by["J"][i]["top1"] == preds_by["L"][i]["top1"] != label[i]]
        print(f"\n두 팔이 같은 답인데 라벨과 다른 건 {len(agree)}건 (앞 {args.review}건)")
        for i in agree[: args.review]:
            it = by_id[i]
            print(f"  {i} {it['raw']} [{it.get('sub', it.get('source'))}] 라벨={it['label']} 두 팔={preds_by['J'][i]['top1']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
