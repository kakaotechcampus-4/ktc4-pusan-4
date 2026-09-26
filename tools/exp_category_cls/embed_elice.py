"""엘리스 모델 라이브러리(OpenAI 임베딩 프록시)로 상호명 임베딩을 만든다.

이 세션에서는 mlapi.run 접속이 막혀 있어 실행이 안 된다. 본인 터미널에서 돌릴 것.

    pip install openai numpy pandas
    export ELICE_BASE_URL="https://mlapi.run/<엔드포인트ID>/v1"
    export ELICE_API_KEY="<발급받은 키>"
    python3 embed_elice.py            # 견적만 출력
    python3 embed_elice.py --run      # 실제 호출

결과: emb_<모델>.npz  (strings, vectors) — run.py 가 이걸 읽어 B3 행을 채운다.
중간에 끊겨도 같은 명령을 다시 실행하면 cache 파일부터 이어서 한다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

import common

BATCH = 256           # 한 번에 보낼 문자열 수
CACHE = "emb_cache.jsonl"


def target_strings(max_train: int) -> list[str]:
    """실험에 실제로 쓰이는 문자열만 모은다 (중복 제거).

    학습 15만 건을 전부 임베딩하면 파일이 GB 단위가 된다. kNN 기준 데이터는
    표본으로 충분하므로 max_train 건만 받는다. 테스트 쪽은 전부 받아야 한다.
    """
    d = common.load()
    train, tests = common.split(d)
    if len(train) > max_train:
        train = train.sample(max_train, random_state=common.SEED)
    texts = set(train["text"])
    for t in tests.values():
        texts |= set(t["text"]) | set(t["brand"])
    return sorted(texts)


def load_cache() -> dict[str, list[float]]:
    done: dict[str, list[float]] = {}
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                    done[row["s"]] = row["v"]
                except json.JSONDecodeError:
                    continue  # 마지막 줄이 잘렸을 수 있다
    return done


def estimate(strings: list[str], won_per_million: float) -> None:
    # 한글은 대략 글자당 1~1.5 토큰. 보수적으로 1.5 로 잡는다.
    tokens = sum(len(s) for s in strings) * 1.5
    print(f"대상 문자열 {len(strings):,}개, 추정 토큰 {tokens:,.0f}개")
    print(f"추정 비용 약 {tokens / 1_000_000 * won_per_million:,.0f}원 "
          f"(단가 {won_per_million}원/1M 가정)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", action="store_true", help="실제 API 호출")
    ap.add_argument("--model", default="text-embedding-3-small")
    ap.add_argument("--won-per-million", type=float, default=32.0)
    ap.add_argument("--dim", type=int, default=256,
                    help="임베딩 차원. 기본 1536은 파일이 GB 단위가 되어 256으로 줄인다")
    ap.add_argument("--max-train", type=int, default=40_000,
                    help="kNN 기준으로 쓸 학습 문자열 수")
    args = ap.parse_args()

    strings = target_strings(args.max_train)
    estimate(strings, args.won_per_million)
    if not args.run:
        print("\n실제로 호출하려면 --run 을 붙여서 다시 실행하세요.")
        return

    base_url, api_key = os.environ.get("ELICE_BASE_URL"), os.environ.get("ELICE_API_KEY")
    if not base_url or not api_key:
        sys.exit("ELICE_BASE_URL / ELICE_API_KEY 환경변수가 필요합니다.")

    from openai import OpenAI  # 여기서 import — 견적만 볼 때는 설치 없이 돈다

    client = OpenAI(base_url=base_url, api_key=api_key)
    done = load_cache()
    todo = [s for s in strings if s not in done]
    print(f"이미 받은 것 {len(done):,} / 남은 것 {len(todo):,}")

    t0 = time.time()
    with open(CACHE, "a", encoding="utf-8") as cache:
        for i in range(0, len(todo), BATCH):
            chunk = todo[i:i + BATCH]
            for attempt in range(5):
                try:
                    res = client.embeddings.create(model=args.model, input=chunk,
                                                   dimensions=args.dim)
                    break
                except Exception as e:                      # 요청 한도·일시 오류 재시도
                    wait = 2 ** attempt
                    print(f"  실패({e.__class__.__name__}) {wait}초 후 재시도", flush=True)
                    time.sleep(wait)
            else:
                sys.exit("연속 실패. 잠시 뒤 같은 명령으로 이어서 하세요.")

            for s, item in zip(chunk, res.data):
                v = [round(float(x), 5) for x in item.embedding]   # 파일 크기를 줄인다
                cache.write(json.dumps({"s": s, "v": v}, ensure_ascii=False) + "\n")
            cache.flush()
            if (i // BATCH) % 20 == 0:
                pct = (i + len(chunk)) / max(len(todo), 1) * 100
                print(f"  {i + len(chunk):,}/{len(todo):,} ({pct:.0f}%) {time.time() - t0:.0f}s",
                      flush=True)

    done = load_cache()
    keys = [s for s in strings if s in done]
    vecs = np.asarray([done[s] for s in keys], dtype=np.float16)   # 파일 크기를 줄인다
    out = f"emb_{args.model}-{args.dim}.npz"
    np.savez_compressed(out, strings=np.asarray(keys, dtype=object), vectors=vecs)
    print(f"\n저장 완료: {out}  ({vecs.shape[0]:,}개 × {vecs.shape[1]}차원)")
    print("이 파일을 대화에 올려 주시면 B3 행을 같은 표에 채웁니다.")


if __name__ == "__main__":
    main()
