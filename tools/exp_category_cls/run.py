"""두 방식을 같은 데이터·같은 지표로 비교한다.

방식 A (머신러닝): char n-gram TF-IDF + 선형 분류기, 확률을 확신도로 사용
방식 B (임베딩):   상호명 벡터의 최근접 이웃 투표, 이웃 득표율을 확신도로 사용
                   B1 = TF-IDF 희소 벡터, B2 = 이를 SVD로 압축한 밀집 벡터(LSA)

외부 임베딩(OpenAI·ko-sroberta)은 vectors 함수만 갈아끼우면 같은 틀에서 비교된다.
"""
from __future__ import annotations

import glob
import os
import sys
import time
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

import common

K = 15
BLOCK = 256


def knn_predict(train_vecs, train_labels, test_vecs, k=K):
    """코사인 유사도 상위 k개의 가중 투표. 확신도 = 1등 라벨의 득표 비중."""
    labels = np.asarray(train_labels)
    preds, confs = [], []
    for start in range(0, test_vecs.shape[0], BLOCK):
        block = test_vecs[start:start + BLOCK]
        sim = (block @ train_vecs.T)
        sim = sim.toarray() if hasattr(sim, "toarray") else np.asarray(sim)
        sim = sim.astype(np.float32, copy=False)
        idx = np.argpartition(-sim, kth=k, axis=1)[:, :k]
        for row, cols in enumerate(idx):
            w = sim[row, cols]
            w = np.clip(w, 0, None)
            votes: dict[str, float] = {}
            for lab, weight in zip(labels[cols], w):
                votes[lab] = votes.get(lab, 0.0) + float(weight)
            total = sum(votes.values()) or 1.0
            best = max(votes.items(), key=lambda kv: kv[1])
            preds.append(best[0])
            confs.append(best[1] / total)
    return np.array(preds), np.array(confs)


def load_external_embeddings():
    """embed_elice.py 가 만든 emb_*.npz 가 있으면 {문자열: 벡터} 로 읽는다."""
    files = sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "emb_*.npz")))
    if not files:
        return None, None
    z = np.load(files[0], allow_pickle=True)
    table = {s: v for s, v in zip(z["strings"], z["vectors"])}
    return os.path.basename(files[0])[4:-4], table


def lookup(table, texts):
    """임베딩 표에서 벡터를 꺼낸다. 없는 문자열은 빠진 위치를 함께 돌려준다."""
    dim = len(next(iter(table.values())))
    vecs, ok = [], []
    for i, t in enumerate(texts):
        v = table.get(t)
        if v is not None:
            vecs.append(v)
            ok.append(i)
    return np.asarray(vecs, dtype=np.float32).reshape(-1, dim), np.asarray(ok, dtype=int)


def main():
    t0 = time.time()
    fair = "--match-emb" in sys.argv   # 외부 임베딩과 같은 학습 표본만 쓰게 맞춘다
    d = common.load()
    train, tests = common.split(d)
    emb_name, emb_table = load_external_embeddings()
    if fair and emb_table:
        train = train[train["text"].isin(emb_table.keys())]
    print(f"데이터: 전체 {len(d):,} / 학습 {len(train):,} / 업종 {train['label'].nunique()}종")
    for name, t in tests.items():
        print(f"  테스트 {name}: {len(t):,}")

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=3, sublinear_tf=True)
    Xtr = vec.fit_transform(train["text"])
    print(f"TF-IDF 특징 {Xtr.shape[1]:,}개 ({time.time()-t0:.0f}s)")

    clf = SGDClassifier(loss="log_loss", alpha=1e-6, max_iter=30, tol=1e-4,
                        random_state=common.SEED, n_jobs=-1)
    clf.fit(Xtr, train["label"])
    print(f"분류기 학습 완료 ({time.time()-t0:.0f}s)")

    svd = TruncatedSVD(n_components=256, random_state=common.SEED)
    Dtr = normalize(svd.fit_transform(Xtr))
    Xtr_n = normalize(Xtr)
    print(f"LSA 임베딩 완료, 설명분산 {svd.explained_variance_ratio_.sum():.2f} ({time.time()-t0:.0f}s)")

    if emb_table:
        Etr, tr_ok = lookup(emb_table, train["text"].tolist())
        Etr = normalize(Etr)
        etr_labels = train["label"].to_numpy()[tr_ok]
        print(f"외부 임베딩 {emb_name}: 학습 {len(tr_ok):,}건 적용 ({time.time()-t0:.0f}s)")

    rows = []
    for cond, test in tests.items():
        branched = test[test["has_branch"]]
        # 입력 두 가지: 지점명이 붙은 문자열 / 지점명을 뗀 브랜드만
        cases = {"지점 붙음": test["text"], "브랜드만": test["brand"]}
        if len(branched):
            cases = {"지점 붙음": branched["text"], "브랜드만": branched["brand"]}
        y = (branched if len(branched) else test)["label"].to_numpy()

        for how, texts in cases.items():
            Xte = vec.transform(texts)

            proba = clf.predict_proba(Xte)
            pred = clf.classes_[proba.argmax(1)]
            rows.append({"방식": "A 분류기(char n-gram)", "조건": cond, "입력": how,
                         **common.precision_coverage(y, pred, proba.max(1))})

            pred, conf = knn_predict(Xtr_n, train["label"], normalize(Xte))
            rows.append({"방식": "B1 임베딩kNN(TF-IDF 희소)", "조건": cond, "입력": how,
                         **common.precision_coverage(y, pred, conf)})

            pred, conf = knn_predict(Dtr, train["label"], normalize(svd.transform(Xte)))
            rows.append({"방식": "B2 임베딩kNN(LSA 256)", "조건": cond, "입력": how,
                         **common.precision_coverage(y, pred, conf)})

            if emb_table:
                Ete, te_ok = lookup(emb_table, list(texts))
                if len(te_ok):
                    pred, conf = knn_predict(Etr, etr_labels, normalize(Ete))
                    rows.append({"방식": f"B3 임베딩kNN({emb_name})", "조건": cond, "입력": how,
                                 **common.precision_coverage(y[te_ok], pred, conf)})
            print(f"{cond}/{how} 완료 ({time.time()-t0:.0f}s)")

    res = pd.DataFrame(rows)
    res.to_csv("results_matched.csv" if fair else "results.csv", index=False)
    print()
    print(res.to_string(index=False, float_format=lambda v: f"{v:.3f}"))


if __name__ == "__main__":
    main()
