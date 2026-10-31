import json
import logging
import threading

import httpx
import pytest
import yaml
from fastapi.testclient import TestClient

from app import main
from app.config import ROOT, settings
from classify import decisions

client = TestClient(main.app)
ITEM = {"merchantNorm": "스타벅스", "merchantRaw": "스타벅스강남R점"}
ANSWER = {"model": "gpt-6-luna", "answers": [
    {"type": "choice", "name": "m000", "choice": "카페", "confidence": 0.93,
     "probabilities": [{"value": "음식점", "probability": 0.05}, {"value": "카페", "probability": 0.93},
                       {"value": "편의점", "probability": 0.01}, {"value": "도서", "probability": 0.01}]},
    {"type": "predicate", "name": "m000_known", "probability": 0.99},
], "usage": {}}


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "classify_api_key", "test-key")
    monkeypatch.setattr(settings, "classify_base_url", "https://gw.example/abc/v1")


def test_요청_본문은_가맹점_하나와_보기_30개와_식별_질문():
    body = decisions.build_body(ITEM, "openai/gpt-6-luna")

    assert body["model"] == "openai/gpt-6-luna"
    assert body["input"] == "가맹점 표기(원문): 스타벅스강남R점\n가맹점 표기(정규화): 스타벅스"
    choice, known = body["questions"]
    assert choice["type"] == "choice" and choice["name"] == "m000"
    assert len(choice["choices"]) == 30
    assert not {"기타", "PG_미상"} & {c["value"] for c in choice["choices"]}
    assert known == {"type": "predicate", "name": "m000_known", "instructions": decisions.SPEC["known_instructions"]}


def test_보기는_카테고리_원본에서_PG_미상과_기타만_뺀_것():
    categories = yaml.safe_load((ROOT / "rules" / "categories.yaml").read_text(encoding="utf-8"))["categories"]

    assert decisions.VALUES == set(categories) - {"PG_미상", "기타"}


def test_정상_답은_업종_확신도_식별확률_상위3():
    assert decisions.parse(ANSWER) == {"category": "카페", "confidence": 0.93, "known": 0.99,
                                       "suggestions": ["카페", "음식점", "편의점"], "refused": False}


def test_거절하면_업종_없이_확신도_0():
    payload = {"answers": [{"type": "refusal", "name": "m000"}, {"type": "predicate", "name": "m000_known", "probability": 0.2}]}

    assert decisions.parse(payload) == {"category": None, "confidence": 0.0, "known": 0.2, "suggestions": [], "refused": True}


def test_식별_질문_답이_없으면_known_은_null():
    assert decisions.parse({"answers": ANSWER["answers"][:1]})["known"] is None


def test_보기에_없는_업종이면_실패로_본다():
    bad = {"answers": [{**ANSWER["answers"][0], "choice": "기타"}]}

    with pytest.raises(ValueError):
        decisions.parse(bad)


@pytest.mark.parametrize("base", ["https://gw.example/abc/v1", "https://gw.example/abc/v1/", "https://gw.example/abc",
                                  "https://gw.example/abc/"])
def test_주소는_끝의_슬래시와_v1_을_떼고_decisions_를_붙인다(base):
    assert decisions.url(base) == "https://gw.example/abc/v1/decisions"


def test_게이트웨이에_가맹점마다_Bearer_로_한_번씩_보내고_HTTP_오류는_null(configured, monkeypatch):
    seen = []

    def handler(request):
        body = json.loads(request.content)
        seen.append((str(request.url), request.headers["Authorization"], body["input"]))
        return httpx.Response(500 if "망가진곳" in body["input"] else 200, json=ANSWER)

    monkeypatch.setattr(decisions, "http", httpx.Client(transport=httpx.MockTransport(handler)))

    results = decisions.classify_all([ITEM, {"merchantNorm": "망가진곳", "merchantRaw": "망가진곳"}])

    assert results[0]["category"] == "카페" and results[1] is None
    assert sorted(seen) == [
        ("https://gw.example/abc/v1/decisions", "Bearer test-key", "가맹점 표기(원문): 망가진곳\n가맹점 표기(정규화): 망가진곳"),
        ("https://gw.example/abc/v1/decisions", "Bearer test-key", "가맹점 표기(원문): 스타벅스강남R점\n가맹점 표기(정규화): 스타벅스"),
    ]


def fake_send(item):
    return {**decisions.parse(ANSWER), "category": item["merchantRaw"]}


def test_분류_응답은_요청_순서대로(configured, monkeypatch):
    monkeypatch.setattr(decisions, "send", fake_send)
    items = [{"merchantNorm": f"가게{i}", "merchantRaw": f"원문{i}"} for i in range(20)]

    res = client.post("/classify/merchants", json={"items": items})

    assert res.status_code == 200
    assert res.json()["model"] == "openai/gpt-6-luna"
    assert [(r["merchantNorm"], r["category"]) for r in res.json()["results"]] == [(f"가게{i}", f"원문{i}") for i in range(20)]
    assert res.json()["results"][0] == {"merchantNorm": "가게0", "category": "원문0", "confidence": 0.93, "known": 0.99,
                                        "suggestions": ["카페", "음식점", "편의점"], "refused": False}


def test_마감을_넘긴_가맹점만_null(configured, monkeypatch, caplog):
    release = threading.Event()

    def slow_send(item):
        if item["merchantNorm"] == "느린곳":
            release.wait(5)
        return fake_send(item)

    monkeypatch.setattr(decisions, "send", slow_send)
    monkeypatch.setattr(settings, "classify_deadline", 0.3)
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    items = [ITEM, {"merchantNorm": "느린곳", "merchantRaw": "느린곳"}, {"merchantNorm": "빠른곳", "merchantRaw": "빠른곳"}]
    try:
        res = client.post("/classify/merchants", json={"items": items})
    finally:
        release.set()

    results = res.json()["results"]
    assert res.status_code == 200
    assert results[1] is None and results[0]["merchantNorm"] == "스타벅스" and results[2]["merchantNorm"] == "빠른곳"
    assert "items=3 ok=2 refused=0 failed=0 timed_out=1" in caplog.text
    assert not any(name in caplog.text for name in ("스타벅스", "느린곳", "빠른곳"))   # 가맹점 이름은 로그에 남기지 않는다


@pytest.mark.parametrize("unset", ["classify_api_key", "classify_base_url"])
def test_키나_주소가_없으면_503(configured, monkeypatch, unset):
    monkeypatch.setattr(settings, unset, None)

    res = client.post("/classify/merchants", json={"items": [ITEM]})

    assert res.status_code == 503 and res.json() == {"detail": "CLASSIFY_UNAVAILABLE"}


@pytest.mark.parametrize("items", [
    [],
    [ITEM] * 201,
    [{**ITEM, "merchantNorm": "가" * 201}],
    [{**ITEM, "merchantRaw": "가" * 201}],
])
def test_요청_검증에_실패하면_422(configured, monkeypatch, items):
    monkeypatch.setattr(decisions, "send", fake_send)

    assert client.post("/classify/merchants", json={"items": items}).status_code == 422
