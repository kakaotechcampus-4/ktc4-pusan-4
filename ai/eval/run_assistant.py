"""비서(Really) 대화 평가. 가짜 백엔드 위에서 실제 모델로 한 턴씩 돌려 채점한다.

사용: python -m eval.run_assistant [--repeat 3] [--only S03,S04] [--workers 4]

모델은 .env 의 ASSISTANT_* 를 그대로 쓴다. 다른 모델을 재려면 그 값을 바꿔 돌린다.
Langfuse 에는 eval-assistant 태그와 실행마다 하나의 세션으로 남는다.

⚠️ CI 에 넣지 않는다. 모델을 부르므로 결정론이 아니다(CONTEXT.md 9.4). 프롬프트·모델·도구를 바꿀 때 돌린다.
"""

from __future__ import annotations

import argparse
import contextlib
import re
import statistics
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml
from langfuse import get_client

from app.config import settings
from assistant.agent import FALLBACK, run_turn
from eval.assistant_fake import BATCH, YEAR, FakeBackend

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CASES = Path(__file__).with_name("assistant_cases.yaml")


def load_cases() -> list[dict]:
    return yaml.safe_load(CASES.read_text(encoding="utf-8"))


def key(p: dict) -> str:
    """제안을 채점용 표기로 바꾼다. 예: answer q-skt 공용"""
    kind = p["kind"]
    target = {"answer": ",".join(p.get("questionIds", [])), "bulk_answer": p.get("factType"),
              "classification": ",".join(p.get("reviewIds", [])), "override": p.get("judgmentId"),
              "navigation": p.get("route")}.get(kind)
    value = {"answer": p.get("value"), "bulk_answer": p.get("value"), "classification": p.get("merchantCategory"),
             "override": p.get("toVerdict")}.get(kind)
    return " ".join(x for x in (kind, target, value) if x)


def grade(case: dict, out: dict) -> list[str]:
    """실패 사유. 비어 있으면 통과다."""
    exp = case.get("expect", {})
    got = sorted(key(p) for p in out["proposals"])
    called = {c[0] for c in out["calls"]}
    answer = out["answer"].replace(",", "")
    fails = ["정해 둔 문구로 답함"] if out["answer"] == FALLBACK else []
    if "proposals" in exp and got != sorted(exp["proposals"]):
        fails.append(f"제안 {got} (기대 {sorted(exp['proposals'])})")
    fails += [f"나오면 안 되는 제안 {k}" for k in got if any(k.startswith(b) for b in exp.get("not_proposed", []))]
    fails += [f"{n} 를 부르지 않음" for n in exp.get("called", []) if n not in called]
    fails += [f"답에 '{c}' 없음" for c in exp.get("contains", []) if str(c).replace(",", "") not in answer]
    fails += [f"답에 /{r}/ 있음" for r in exp.get("not_matches", []) if re.search(r, out["answer"])]
    return fails


def run_case(case: dict, session: str) -> dict:
    fake = FakeBackend()
    if "keep_questions" in case:
        fake.questions = [q for q in fake.questions if q[0] in case["keep_questions"]]
    context = {"screen": case.get("screen", "/questions"), "batchId": BATCH, "transactionId": None, "year": YEAR}
    t0 = time.perf_counter()
    out = run_turn(case["message"], [], context, None, session_id=session, backend=fake,
                   tags=["eval-assistant", case["id"]])
    return {"id": case["id"], "secs": time.perf_counter() - t0, "fails": grade(case, out), "answer": out["answer"],
            "proposals": [key(p) for p in out["proposals"]], "calls": [c[0] for c in out["calls"]]}


def main() -> int:
    ap = argparse.ArgumentParser(description="비서 대화 평가")
    ap.add_argument("--repeat", type=int, default=1, help="시나리오마다 반복 횟수")
    ap.add_argument("--only", help="쉼표로 구분한 시나리오 id")
    ap.add_argument("--workers", type=int, default=4, help="동시에 돌릴 턴 수")
    args = ap.parse_args()
    if not (settings.assistant_model and settings.assistant_api_key and settings.assistant_base_url):
        print("ASSISTANT_MODEL · ASSISTANT_BASE_URL · ASSISTANT_API_KEY 가 .env 에 없습니다")
        return 2

    cases = load_cases()
    if args.only:
        cases = [c for c in cases if c["id"] in args.only.split(",")]
    session = f"eval-assistant-{datetime.now(timezone(timedelta(hours=9))):%Y%m%d-%H%M%S}"
    with ThreadPoolExecutor(args.workers) as pool:
        rows = list(pool.map(lambda c: run_case(c, session), [c for c in cases for _ in range(args.repeat)]))
    get_client().flush()

    by_case = defaultdict(list)
    for r in rows:
        by_case[r["id"]].append(r)
        if r["fails"]:
            print(f"FAIL {r['id']} {r['secs']:.1f}s  {' · '.join(r['fails'])}")
            print(f"     도구 {r['calls']}  답: {r['answer'][:160]}")
    print(f"\n모델 {settings.assistant_model}  세션 {session} (Langfuse 태그 eval-assistant)")
    print(" ".join(f"{cid} {sum(not r['fails'] for r in rs)}/{len(rs)}" for cid, rs in by_case.items()))
    secs = sorted(r["secs"] for r in rows)
    passed = sum(not r["fails"] for r in rows)
    print(f"통과 {passed}/{len(rows)}  턴 중앙값 {statistics.median(secs):.1f}s  최대 {secs[-1]:.1f}s")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
