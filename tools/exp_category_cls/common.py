"""카테고리 분류 방식 비교 실험 — 공통 데이터 준비.

데이터: 소상공인 상권정보(상호명/지점명/상권업종중분류명).
카드 이용내역 문자열을 흉내내기 위해 상호명과 지점명을 붙여 입력을 만든다.

평가 조건 두 가지
  unseen_brand : 학습에 없던 브랜드 (그룹 분리). 실제 롱테일에 해당.
  seen_brand   : 학습에 있던 브랜드의 다른 지점. 캐시가 못 잡는 경우에 해당.
"""
from __future__ import annotations

import os
import re
import numpy as np
import pandas as pd

# 데이터 위치: DATASET 환경변수 > 현재 폴더 data/sample.csv
_CANDIDATES = [
    os.environ.get("DATASET", ""),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sample.csv"),
]
SAMPLE = next((p for p in _CANDIDATES if p and os.path.exists(p)), _CANDIDATES[1])
SEED = 42
MIN_LABEL_COUNT = 300  # 표본이 너무 적은 업종은 제외


def _norm(s: str) -> str:
    """T1 정규화의 축약판 — 공백·특수문자 제거, 영문 대문자화."""
    s = re.sub(r"[^0-9A-Za-z가-힣]", "", str(s))
    return s.upper()


def load() -> pd.DataFrame:
    d = pd.read_csv(SAMPLE, dtype=str)
    d["지점명"] = d["지점명"].fillna("")
    d["brand"] = d["상호명"].map(_norm)
    d["branch"] = d["지점명"].map(_norm)
    d = d[d["brand"].str.len() >= 2]

    # 카드 문자열: 상호명 + 지점명 을 공백 없이 붙인다 (씨유강남점 형태)
    d["text"] = d["brand"] + d["branch"]
    d["label"] = d["상권업종중분류명"]
    d["has_branch"] = d["branch"].str.len() > 0

    keep = d["label"].value_counts()
    keep = set(keep[keep >= MIN_LABEL_COUNT].index)
    d = d[d["label"].isin(keep)].reset_index(drop=True)
    return d


def split(d: pd.DataFrame, n_test_per_cond: int = 5000, n_train: int = 150_000):
    """브랜드 단위로 나눈 뒤 두 평가 조건을 만든다."""
    rng = np.random.default_rng(SEED)
    brands = d["brand"].unique()
    rng.shuffle(brands)
    n_hold = int(len(brands) * 0.2)
    held = set(brands[:n_hold])

    train_pool = d[~d["brand"].isin(held)]
    unseen_pool = d[d["brand"].isin(held)]

    # seen_brand 조건: 학습에 브랜드가 남아 있는 지점 행을 테스트로 빼낸다
    seen_cand = train_pool[train_pool["has_branch"]]
    dup_brands = seen_cand["brand"].value_counts()
    dup_brands = set(dup_brands[dup_brands >= 2].index)
    seen_cand = seen_cand[seen_cand["brand"].isin(dup_brands)]
    seen_test = seen_cand.groupby("brand", group_keys=False).sample(1, random_state=SEED)
    seen_test = seen_test.sample(min(n_test_per_cond, len(seen_test)), random_state=SEED)

    train = train_pool.drop(index=seen_test.index)
    if len(train) > n_train:
        train = train.sample(n_train, random_state=SEED)
    unseen_test = unseen_pool.sample(min(n_test_per_cond, len(unseen_pool)), random_state=SEED)

    return train.reset_index(drop=True), {
        "unseen_brand": unseen_test.reset_index(drop=True),
        "seen_brand": seen_test.reset_index(drop=True),
    }


def precision_coverage(y_true, y_pred, conf, targets=(0.90, 0.95)) -> dict:
    """확신도로 자른 뒤의 정밀도와 자동화율. 목표 정밀도를 지키는 최대 자동화율을 찾는다."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    conf = np.asarray(conf, dtype=float)
    order = np.argsort(-conf)
    correct = (y_true[order] == y_pred[order]).astype(float)
    cum_prec = np.cumsum(correct) / np.arange(1, len(correct) + 1)
    coverage = np.arange(1, len(correct) + 1) / len(correct)

    out = {"accuracy": float(correct.mean())}
    for t in targets:
        ok = np.where(cum_prec >= t)[0]
        if len(ok) == 0:
            out[f"auto@p{int(t*100)}"] = 0.0
        else:
            out[f"auto@p{int(t*100)}"] = float(coverage[ok[-1]])
    return out
