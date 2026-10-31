"""규칙 분류기가 못 정한 카드 가맹점의 업종을 GPT-6 Luna /v1/decisions 에 묻는다.

가맹점 하나에 요청 하나다. 여러 가맹점을 한 요청에 묶으면 답의 25% 가 바뀌어 실험에서 잰 임계값이 맞지 않는다.
여기서는 숫자만 돌려준다. 확정할지는 백엔드가 임계값으로 정한다.
"""

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, wait
from pathlib import Path

import httpx

from app.config import settings

# 실험(PR1)에서 고정한 질문이다. 고치면 임계값을 다시 잰다(source 참고).
SPEC = json.loads(Path(__file__).with_name("choices.json").read_text(encoding="utf-8"))
VALUES = {c["value"] for c in SPEC["choices"]}
# uvicorn 이 INFO 핸들러를 달아 둔 로거다. 앱 로거는 루트 기본값(WARNING)이라 info 가 버려진다.
logger = logging.getLogger("uvicorn.error")
pool = ThreadPoolExecutor(max_workers=settings.classify_concurrency)
http = httpx.Client(timeout=settings.classify_call_timeout)


def url(base: str) -> str:
    return base.rstrip("/").removesuffix("/v1") + "/v1/decisions"


def build_body(item: dict, model: str) -> dict:
    return {
        "model": model,
        "input": SPEC["input_template"].format(merchantRaw=item["merchantRaw"], merchantNorm=item["merchantNorm"]),
        "questions": [
            {"type": "choice", "name": SPEC["choice_name"], "instructions": SPEC["instructions"], "choices": SPEC["choices"]},
            {"type": "predicate", "name": SPEC["known_name"], "instructions": SPEC["known_instructions"]},
        ],
    }


def parse(payload: dict) -> dict:
    answers = {a["name"]: a for a in payload["answers"]}
    choice = answers[SPEC["choice_name"]]
    known = answers.get(SPEC["known_name"], {}).get("probability")
    if choice["type"] == "refusal":
        return {"category": None, "confidence": 0.0, "known": known, "suggestions": [], "refused": True}
    top = sorted(choice["probabilities"], key=lambda p: p["probability"], reverse=True)[:3]
    suggestions = [p["value"] for p in top]
    if not {choice["choice"], *suggestions} <= VALUES:
        raise ValueError("보기에 없는 업종")
    return {"category": choice["choice"], "confidence": choice["confidence"], "known": known,
            "suggestions": suggestions, "refused": False}


def send(item: dict) -> dict:
    res = http.post(url(settings.classify_base_url), json=build_body(item, settings.classify_model),
                    headers={"Authorization": f"Bearer {settings.classify_api_key}"})
    res.raise_for_status()
    return parse(res.json())


def classify_all(items: list[dict]) -> list[dict | None]:
    """요청 순서대로 돌려준다. 실패했거나 마감까지 못 받은 가맹점은 None 이다. 재시도하지 않는다."""
    start = time.monotonic()
    futures = [pool.submit(send, item) for item in items]
    done, _ = wait(futures, timeout=settings.classify_deadline)
    results, failed, late = [], 0, 0
    for item, future in zip(items, futures):
        if future not in done:
            future.cancel()
            late += 1
            results.append(None)
        elif future.exception():
            failed += 1
            results.append(None)
        else:
            results.append({"merchantNorm": item["merchantNorm"], **future.result()})
    refused = sum(1 for r in results if r and r["refused"])
    # 가맹점 이름은 남기지 않는다.
    logger.info("classify items=%d ok=%d refused=%d failed=%d timed_out=%d elapsed_ms=%d", len(items),
                len(items) - refused - failed - late, refused, failed, late, (time.monotonic() - start) * 1000)
    return results
