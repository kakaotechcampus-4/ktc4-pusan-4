"""PR #47 리뷰 반영 — 두 가지 추가 측정.

1) 임베딩 + 선형 분류기(B3-LR)
   기존 B3 는 "OpenAI 임베딩 + kNN" 이라, A(char n-gram + LR)와 비교하면 표현과 분류기가
   동시에 달라 어느 쪽 차이인지 분리가 안 됐다. 같은 임베딩에 LR 을 얹어 분리한다.

2) EUC-KR 20바이트 절단
   실카드 가맹점명은 20바이트에서 잘린다. 입력을 잘라서 A 가 끝 조각에 얼마나 기대는지 본다.
   - 학습·평가 모두 절단 (리뷰 요청 조건)
   - 학습은 원문, 평가만 절단 (상권정보로 학습하고 실카드에 쓰는 실제 상황)
   B3 는 절단 문자열의 임베딩이 없어 이 측정에서 빠진다 (embed_elice.py 를 다시 돌려야 한다).

모든 방식은 B3 임베딩이 있는 학습 4만 건으로 맞춘다 (run.py --match-emb 와 같은 조건).
"""
from __future__ import annotations

import re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.preprocessing import normalize

import common
from run import knn_predict, load_external_embeddings, lookup
from run_residual import rule_patterns

MAX_BYTES = 20


def trunc(s: str, n: int = MAX_BYTES) -> str:
    """EUC-KR 기준 n 바이트를 넘지 않게 글자 단위로 자른다 (글자를 반으로 쪼개지 않음)."""
    used, out = 0, []
    for ch in s:
        try:
            size = len(ch.encode("euc-kr"))
        except UnicodeEncodeError:
            size = 1  # 확장 한글 등은 파서처럼 '?' 1바이트로 센다
        if used + size > n:
            break
        used += size
        out.append(ch)
    return "".join(out)


def char_lr(train_texts, labels):
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=3, sublinear_tf=True)
    X = vec.fit_transform(train_texts)
    clf = SGDClassifier(loss="log_loss", alpha=1e-6, max_iter=30, tol=1e-4,
                        random_state=common.SEED, n_jobs=-1).fit(X, labels)
    return vec, clf


def score_clf(vec, clf, texts, y):
    P = clf.predict_proba(vec.transform(texts))
    return common.precision_coverage(y, clf.classes_[P.argmax(1)], P.max(1))


def main():
    d = common.load()
    train, tests = common.split(d)
    emb_name, table = load_external_embeddings()
    train = train[train["text"].isin(table.keys())].reset_index(drop=True)
    y_tr = train["label"].to_numpy()

    # 평가 세트: 기존 4조건 + 잔여분
    pats = rule_patterns()
    bc = d["brand"].value_counts()
    evals = {}
    for cond, t in tests.items():
        b = t[t["has_branch"]]
        evals[f"{cond}·지점붙음"] = (b["text"], b["label"].to_numpy())
        evals[f"{cond}·브랜드만"] = (b["brand"], b["label"].to_numpy())
    r = tests["unseen_brand"]
    r = r[r["has_branch"]]
    r = r[~r["text"].map(lambda s: any(p.search(s) for p in pats))]
    r = r[r["brand"].map(lambda x: bc.get(x, 0) == 1)]
    evals["잔여분"] = (r["text"], r["label"].to_numpy())

    # ── 1) 표현 vs 분류기 분리 ─────────────────────────────
    vec, clf = char_lr(train["text"], y_tr)
    Etr, ok = lookup(table, train["text"].tolist())
    Etr = normalize(Etr)
    lr = LogisticRegression(max_iter=500, C=10.0).fit(Etr, y_tr[ok])

    rows = []
    for name, (texts, y) in evals.items():
        rows.append({"평가": name, "방식": "A char n-gram + LR", **score_clf(vec, clf, texts, y)})
        Ete, te_ok = lookup(table, list(texts))
        Ete = normalize(Ete)
        P = lr.predict_proba(Ete)
        rows.append({"평가": name, "방식": "B3 임베딩 + LR",
                     **common.precision_coverage(y[te_ok], lr.classes_[P.argmax(1)], P.max(1))})
        pred, conf = knn_predict(Etr, y_tr[ok], Ete)
        rows.append({"평가": name, "방식": "B3 임베딩 + kNN",
                     **common.precision_coverage(y[te_ok], pred, conf)})
    part1 = pd.DataFrame(rows)

    # ── 2) 20바이트 절단 ──────────────────────────────────
    tr_trunc = train["text"].map(trunc)
    vec_t, clf_t = char_lr(tr_trunc, y_tr)
    rows = []
    for name, (texts, y) in evals.items():
        if name.endswith("브랜드만"):
            continue
        tt = texts.map(trunc)
        changed = (tt != texts).to_numpy()
        rows.append({"평가": name, "절단된 비율": changed.mean(),
                     "원문": score_clf(vec, clf, texts, y)["auto@p95"],
                     "평가만 절단": score_clf(vec, clf, tt, y)["auto@p95"],
                     "학습·평가 절단": score_clf(vec_t, clf_t, tt, y)["auto@p95"]})
        if changed.sum() >= 100:  # 실제로 잘린 것만 따로
            rows.append({"평가": name + " (잘린 것만)", "절단된 비율": 1.0,
                         "원문": score_clf(vec, clf, texts[changed], y[changed])["auto@p95"],
                         "평가만 절단": score_clf(vec, clf, tt[changed], y[changed])["auto@p95"],
                         "학습·평가 절단": score_clf(vec_t, clf_t, tt[changed], y[changed])["auto@p95"]})
    part2 = pd.DataFrame(rows)

    fmt = lambda v: f"{v:.3f}"
    print("[1] 표현 vs 분류기 (학습 4만 건 통일)")
    print(part1.pivot(index="평가", columns="방식", values="auto@p95").to_string(float_format=fmt))
    print()
    print("[2] EUC-KR 20바이트 절단 — A 분류기 auto@p95")
    print(part2.to_string(index=False, float_format=fmt))
    part1.to_csv("results_review2_repr.csv", index=False)
    part2.to_csv("results_review2_trunc.csv", index=False)


if __name__ == "__main__":
    main()
