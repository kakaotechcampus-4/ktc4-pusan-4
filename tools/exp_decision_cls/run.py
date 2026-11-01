"""평가셋을 J · L 에 보내고 응답을 data/cache.jsonl 에 쌓는다.

    python tools/exp_decision_cls/run.py --arm J L --set res --split dev
    python tools/exp_decision_cls/run.py --arm J L --set res kwonly repo --split test
    python tools/exp_decision_cls/run.py --arm J L --set res --split test --batch 30 --workers 1
    python tools/exp_decision_cls/run.py --arm J L --set res --split test --limit 100 --repeat 3

캐시 키는 팔 + 요청 본문 + 반복 번호다. 같은 요청은 다시 보내지 않고, 실패한 요청만 다시 보낸다.
지연을 재는 배치 실행은 --workers 1 로 돌린다(B10 은 업로드마다 한 번 부른다).
"""
from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import common as c


def send(arm: str, cfg: dict, job: tuple) -> dict:
    key, rep, g, body = job
    rec = {"key": key, "arm": arm, "model": cfg["model"], "batch": len(g), "rep": rep,
           "ids": [it["id"] for it in g], "ts": time.strftime("%Y-%m-%dT%H:%M:%S")} | c.post(cfg, body)
    c.append_cache(rec)
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", nargs="+", choices=["J", "L"], required=True)
    ap.add_argument("--set", nargs="+", choices=["res", "kwonly", "repo"], required=True)
    ap.add_argument("--split", choices=["dev", "test", "all"], default="test")
    ap.add_argument("--batch", type=int, default=1, help="한 요청에 넣는 가맹점 수")
    ap.add_argument("--repeat", type=int, default=1, help="같은 요청 반복 횟수(안정성)")
    ap.add_argument("--limit", type=int, default=0, help="앞에서부터 N건만 (id 순)")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    items = sorted(c.load_testset(args.set, args.split), key=lambda it: it["id"])
    if args.limit:
        items = items[: args.limit]
    groups = c.batches(items, args.batch)
    cache = c.load_cache()

    for arm in args.arm:
        cfg = c.arm_config(arm)
        jobs = []
        for rep in range(args.repeat):
            for g in groups:
                body = c.build_body(arm, cfg["model"], g)
                key = c.cache_key(arm, body, rep)
                hit = cache.get(key)
                if hit and hit["status"] == 200:
                    continue
                jobs.append((key, rep, g, body))
        print(f"[{arm}] {cfg['model']} · 요청 {len(groups) * args.repeat}개 중 새로 보낼 것 {len(jobs)}개", flush=True)

        done = fail = 0
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            for fut in as_completed([pool.submit(send, arm, cfg, j) for j in jobs]):
                rec = fut.result()
                done += 1
                if rec["status"] != 200:
                    fail += 1
                    print(f"  실패 {rec['status']}: {str(rec['payload'])[:200]}", flush=True)
                if done % 50 == 0 or done == len(jobs):
                    print(f"  {done}/{len(jobs)} (실패 {fail}, {time.time() - t0:.0f}초)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
