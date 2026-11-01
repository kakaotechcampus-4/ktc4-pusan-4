"""Jev · Luna 6 /decisions 카테고리 분류 비교 — 공통.

팔 표기: J = Jev(typesafe), L = GPT-6 Luna(openai). 둘 다 POST /v1/decisions 지만 요청 형식이 다르다.
두 팔에는 같은 지시문 · 같은 선택지 설명 · 같은 입력 문자열을 준다. 형식만 각자 계약에 맞춘다.

자격증명
  J: 이 워크트리의 .env.jev  (JEV_API_KEY, JEV_BASE_URL)
  L: 메인 레포 .env          (AGENT_API_KEY, AGENT_BASE_URL)  — LUNA_ENV 로 바꿀 수 있다
키는 출력하지 않는다. 이 repo 는 public 이다.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import os
import random
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DATA = HERE / "data"
CACHE = DATA / "cache.jsonl"
TESTSET = DATA / "testset.jsonl"


def load_module(name: str, path: Path):
    """tools/exp_* 의 common.py 끼리 이름이 겹쳐서 경로로 불러온다."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ------------------------------------------------------------------ 카테고리
_vr = load_module("validate_rules", ROOT / "tools" / "validate_rules.py")
# PG_미상 은 PG 차단이 앞에서 정하고 사전 등록도 금지라 분류기 출력이 아니다.
CATEGORIES = [c for c in _vr.CATEGORY_ENUM if c != "PG_미상"]


# 선택지 설명 판. dev 에서 정했다(docs/category_decision_eval.md).
#   meta     CATEGORY_META 의 예시 · 비고 그대로
#   mapping  meta + 상권정보 소분류 매핑표의 포함 업종. 기타는 "모르겠다" 가 아니라 목록 밖 업종으로 다시 정의
DESC_VARIANT = os.environ.get("DECISION_DESC", "mapping")
MAPPING = ROOT / "tools" / "exp_merchant_match" / "mapping_940909.csv"


def _mapping_subs() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    with MAPPING.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            out.setdefault(r["카테고리"], []).append(r["소분류"])
    return out


SUBS = _mapping_subs()


def describe(category: str) -> str:
    examples, _nature, note = _vr.CATEGORY_META[category]
    if DESC_VARIANT == "mapping" and category == "기타":
        text = "목록의 다른 업종 어디에도 속하지 않는 업종. 어느 업종인지 모르겠다는 뜻으로 고르지 않는다"
    else:
        text = "예: " + ", ".join(examples)
        if note and note != "—":
            text += ". " + note
    if DESC_VARIANT == "mapping" and SUBS.get(category):
        text += ". 포함 업종: " + ", ".join(SUBS[category])
    return text


INSTRUCTIONS = (
    "카드 승인내역에 찍힌 가맹점 표기를 보고, 이 가맹점이 무엇을 하는 곳인지 가장 알맞은 업종 카테고리를 고르세요. "
    "표기는 EUC-KR 20바이트에서 잘렸을 수 있고 지점명이 붙어 있을 수 있습니다."
)


def content(items: list[dict]) -> str:
    """두 팔에 똑같이 들어가는 입력 문자열."""
    if len(items) == 1:
        it = items[0]
        return f"가맹점 표기(원문): {it['raw']}\n가맹점 표기(정규화): {it['norm']}"
    lines = ["카드 승인내역 가맹점 목록"]
    lines += [f"{qid(i)}: 원문={it['raw']} / 정규화={it['norm']}" for i, it in enumerate(items)]
    return "\n".join(lines)


def qid(i: int) -> str:
    return f"m{i:03d}"


def question_text(i: int, n: int) -> str:
    return INSTRUCTIONS if n == 1 else f"{INSTRUCTIONS} 대상은 목록의 {qid(i)} 가맹점입니다."


# 질문 판. 기본 판의 요청 본문은 바꾸지 않는다(캐시 키가 본문 해시다).
#   DECISION_CHOICES  all(기본) | no_other  — no_other 는 선택지에서 기타를 뺀다
#   DECISION_KNOWN=1  "표기만으로 업종을 알 수 있나" 예/아니오 질문을 가맹점마다 하나 더 붙인다
CHOICES_VARIANT = os.environ.get("DECISION_CHOICES", "all")
ASK_KNOWN = os.environ.get("DECISION_KNOWN") == "1"
KNOWN_INSTRUCTIONS = (
    "카드 승인내역에 찍힌 가맹점 표기만 보고, 이 가맹점이 무엇을 하는 곳인지(업종) 알 수 있습니까? "
    "상호에 업종을 드러내는 말이 있거나 널리 알려진 브랜드 · 서비스면 예, "
    "사람 이름이나 뜻이 모호한 상호라서 업종을 짐작할 수 없으면 아니오입니다."
)


def choice_set() -> list[str]:
    return [c for c in CATEGORIES if not (CHOICES_VARIANT == "no_other" and c == "기타")]


def kid(i: int) -> str:
    return f"{qid(i)}_known"


def known_text(i: int, n: int) -> str:
    return KNOWN_INSTRUCTIONS if n == 1 else f"{KNOWN_INSTRUCTIONS} 대상은 목록의 {qid(i)} 가맹점입니다."


# ------------------------------------------------------------------ 요청 · 응답
def build_body(arm: str, model: str, items: list[dict]) -> dict:
    n = len(items)
    if arm == "J":
        criteria = {c: describe(c) for c in choice_set()}
        questions = {}
        for i in range(n):
            questions[qid(i)] = {"type": "choice", "instructions": question_text(i, n), "criteria": criteria}
            if ASK_KNOWN:
                questions[kid(i)] = {"type": "noul", "instructions": known_text(i, n)}
        return {"model": model, "state": content(items), "questions": questions}
    if arm == "L":
        choices = [{"value": c, "description": describe(c)} for c in choice_set()]
        questions = []
        for i in range(n):
            questions.append({"type": "choice", "name": qid(i), "instructions": question_text(i, n), "choices": choices})
            if ASK_KNOWN:
                questions.append({"type": "predicate", "name": kid(i), "instructions": known_text(i, n)})
        return {"model": model, "input": content(items), "questions": questions}
    raise ValueError(arm)


def _probs(raw) -> dict[str, float]:
    if isinstance(raw, dict):
        return {k: float(v) for k, v in raw.items()}
    if isinstance(raw, list):
        out = {}
        for x in raw:
            key = x.get("value") or x.get("choice") or x.get("label") or x.get("key")
            out[key] = float(x.get("probability", x.get("p", 0.0)))
        return out
    return {}


def parse_answers(arm: str, payload: dict, n: int) -> list[dict]:
    """응답을 질문 순서대로 [{top1, confidence, top3, probs, known, refused}] 로 바꾼다. known 은 예일 확률.

    L 은 맞는 선택지가 없다고 보면 {"type": "refusal"} 로 답한다(기타를 뺀 판에서 나왔다).
    1등 없음 · 신뢰도 0 으로 둔다. 채점에서는 오답이고 추천 없는 미정이다.
    """
    answers = payload.get("answers")
    if arm == "L" and isinstance(answers, list):
        answers = {a.get("name"): a for a in answers}
    answers = answers or {}
    out = []
    for i in range(n):
        a = answers.get(qid(i)) or {}
        refused = a.get("type") == "refusal"
        probs = _probs(a.get("probabilities"))
        top1 = a.get("choice")
        conf = a.get("confidence")
        conf = float(conf) if conf is not None else (probs.get(top1) if top1 in probs else None)
        if refused:
            conf = 0.0
        top3 = [k for k, _ in sorted(probs.items(), key=lambda kv: -kv[1])[:3]]
        k = answers.get(kid(i)) or {}
        known = k.get("noul") if arm == "J" else k.get("probability")
        out.append({"top1": top1, "confidence": conf, "top3": top3, "probs": probs,
                    "known": float(known) if known is not None else None, "refused": refused})
    return out


# ------------------------------------------------------------------ 자격증명 · 호출
def read_env(path: Path) -> dict[str, str]:
    """KEY=값, KEY = "값" 둘 다 읽는다(.env.jev 가 뒤쪽 형태다)."""
    out = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main_repo() -> Path:
    common_dir = subprocess.run(["git", "rev-parse", "--git-common-dir"], cwd=ROOT,
                                capture_output=True, text=True, check=True).stdout.strip()
    return (ROOT / common_dir).resolve().parent


def arm_config(arm: str) -> dict:
    if arm == "J":
        env = read_env(ROOT / ".env.jev")
        key, base = env.get("JEV_API_KEY"), env.get("JEV_BASE_URL")
        # 게이트웨이는 버전을 붙인 이름만 받는다(typesafe/jev 는 400). 재현을 위해 고정한다.
        model = os.environ.get("JEV_MODEL", "typesafe/jev-1.14")
    elif arm == "L":
        env = read_env(Path(os.environ.get("LUNA_ENV") or main_repo() / ".env"))
        key, base = env.get("AGENT_API_KEY"), env.get("AGENT_BASE_URL")
        model = os.environ.get("LUNA_MODEL", "openai/gpt-6-luna")
    else:
        raise ValueError(arm)
    if not key or not base:
        raise SystemExit(f"{arm}: API 키 또는 주소가 env 에 없습니다")
    base = base.rstrip("/").removesuffix("/v1")
    return {"arm": arm, "key": key, "url": base + "/v1/decisions", "model": model}


RETRY_STATUS = {0, 429, 500, 502, 503, 504}


def post(cfg: dict, body: dict, timeout: float = 30.0, retries: int = 3) -> dict:
    """한 요청. 마지막 시도의 상태 · 지연(ms) · 본문을 돌려준다. 키는 결과에 넣지 않는다."""
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Authorization": f"Bearer {cfg['key']}", "Content-Type": "application/json",
               "User-Agent": "ktc4-exp-decision/0.1"}
    for attempt in range(retries + 1):
        req = urllib.request.Request(cfg["url"], data=data, headers=headers, method="POST")
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                status, text = r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            status, text = e.code, e.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            status, text = 0, f"{type(e).__name__}: {e}"
        ms = (time.perf_counter() - t0) * 1000
        if status not in RETRY_STATUS or attempt == retries:
            break
        time.sleep(2 ** attempt)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = text
    return {"status": status, "latency_ms": round(ms, 1), "attempts": attempt + 1, "payload": payload}


# ------------------------------------------------------------------ 평가셋 · 배치
def load_testset(sets: list[str], split: str) -> list[dict]:
    items = [json.loads(line) for line in TESTSET.read_text(encoding="utf-8").splitlines()]
    return [it for it in items if it["set"] in sets and (split == "all" or it["split"] == split)]


def batches(items: list[dict], n: int, seed: int = 42) -> list[list[dict]]:
    """평가셋은 카테고리 순서라 그대로 묶으면 한 요청이 한 카테고리로 찬다. 섞어서 묶는다."""
    if n == 1:
        return [[it] for it in items]
    items = sorted(items, key=lambda it: it["id"])
    random.Random(seed).shuffle(items)
    return [items[i:i + n] for i in range(0, len(items), n)]


# ------------------------------------------------------------------ 캐시
_lock = threading.Lock()


def cache_key(arm: str, body: dict, rep: int) -> str:
    blob = json.dumps({"arm": arm, "body": body, "rep": rep}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def load_cache() -> dict[str, dict]:
    if not CACHE.exists():
        return {}
    out = {}
    with CACHE.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            out[rec["key"]] = rec
    return out


def append_cache(rec: dict) -> None:
    DATA.mkdir(exist_ok=True)
    with _lock, CACHE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
