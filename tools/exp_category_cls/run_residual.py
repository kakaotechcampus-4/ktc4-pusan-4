"""잔여분(전처리기가 못 거른 것)에서만 세 방식을 비교한다.

실제 파이프라인에서 모델이 보는 입력은 전체가 아니라
  캐시 miss + 키워드룰 miss + PG 아님
인 잔여분이다. 그래서 테스트를 다음 조건으로 좁힌다.

  1) 학습에 없던 브랜드 (그룹 분리)
  2) 팀 레포 rules/keyword_rules.yaml 의 어떤 룰에도 안 걸림
  3) 상권정보 전체에서 그 상호명이 한 곳뿐 (= 체인이 아닌 개별 사업장)
  4) 지점명이 붙어 있는 문자열

학습 쪽은 그대로 둔다. 잔여분만 학습시킬 이유가 없기 때문이다.
"""
from __future__ import annotations

import re
import sys
import time
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.preprocessing import normalize

import common
from run import knn_predict, load_external_embeddings, lookup

RULES = "/mnt/user-data/uploads/kakaoTechCampus/ktc4-pusan-4/rules/keyword_rules.yaml"


def rule_patterns() -> list[re.Pattern]:
    """yaml 을 정식 파싱하지 않고 match: 값만 뽑는다 (PyYAML 의존 회피)."""
    pats = []
    for line in open(RULES, encoding="utf-8"):
        m = re.search(r'match:\s*"([^"]+)"', line)
        if m:
            try:
                pats.append(re.compile(m.group(1), re.IGNORECASE))
            except re.error:
                continue
    return pats


def main():
    t0 = time.time()
    d = common.load()
    train, tests = common.split(d)

    emb_name, emb_table = load_external_embeddings()
    if emb_table:  # 공정 비교: 임베딩이 가진 만큼만 학습에 쓴다
        train = train[train["text"].isin(emb_table.keys())]

    pats = rule_patterns()
    print(f"키워드룰 {len(pats)}개 적용")

    brand_count = d["brand"].value_counts()
    test = tests["unseen_brand"]
    test = test[test["has_branch"]]
    before = len(test)
    test = test[~test["text"].map(lambda s: any(p.search(s) for p in pats))]
    after_rule = len(test)
    test = test[test["brand"].map(lambda b: brand_count.get(b, 0) == 1)]
    print(f"미지 브랜드·지점 붙음 {before:,} → 룰 미매칭 {after_rule:,} → 단일 점포 {len(test):,}")

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=3, sublinear_tf=True)
    Xtr = vec.fit_transform(train["text"])
    clf = SGDClassifier(loss="log_loss", alpha=1e-6, max_iter=30, tol=1e-4,
                        random_state=common.SEED, n_jobs=-1)
    clf.fit(Xtr, train["label"])
    Xtr_n = normalize(Xtr)
    if emb_table:
        Etr, tr_ok = lookup(emb_table, train["text"].tolist())
        Etr = normalize(Etr)
        etr_labels = train["label"].to_numpy()[tr_ok]
    print(f"학습 {len(train):,}건 완료 ({time.time()-t0:.0f}s)")

    rows = []
    y = test["label"].to_numpy()
    Xte = vec.transform(test["text"])

    proba = clf.predict_proba(Xte)
    rows.append({"방식": "A 분류기", **common.precision_coverage(y, clf.classes_[proba.argmax(1)],
                                                              proba.max(1))})
    pred, conf = knn_predict(Xtr_n, train["label"], normalize(Xte))
    rows.append({"방식": "B1 kNN(TF-IDF)", **common.precision_coverage(y, pred, conf)})

    if emb_table:
        Ete, te_ok = lookup(emb_table, test["text"].tolist())
        if len(te_ok):
            pred, conf = knn_predict(Etr, etr_labels, normalize(Ete))
            rows.append({"방식": f"B3 kNN({emb_name})",
                         **common.precision_coverage(y[te_ok], pred, conf)})

    res = pd.DataFrame(rows)
    res.to_csv("results_residual.csv", index=False)
    print()
    print(res.to_string(index=False, float_format=lambda v: f"{v:.3f}"))


if __name__ == "__main__":
    main()
