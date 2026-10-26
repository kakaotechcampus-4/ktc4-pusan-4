"""비서 에이전트 루프. 가짜 LLM과 가짜 백엔드로 돈다."""

import json
from types import SimpleNamespace

import pytest

from app.config import settings
from assistant import agent
from eval.assistant_fake import BATCH, YEAR, FakeBackend

QUESTIONS = {"screen": "/questions", "batchId": BATCH, "transactionId": None, "year": YEAR}


def reply(content: str | None = None, *calls: tuple[str, dict]):
    tool_calls = [SimpleNamespace(id=f"call{i}", function=SimpleNamespace(name=n, arguments=json.dumps(a, ensure_ascii=False)))
                  for i, (n, a) in enumerate(calls)] or None
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=tool_calls))])


class FakeAPI:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.requests: list[dict] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.requests.append({**kwargs, "messages": list(kwargs["messages"])})
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture(autouse=True)
def luna(monkeypatch):
    monkeypatch.setattr(settings, "assistant_model", "openai/gpt-6-luna")
    monkeypatch.setattr(settings, "assistant_reasoning_effort", "none")


def run(api: FakeAPI, message: str, context=QUESTIONS, history=()) -> dict:
    return agent.run_turn(message, list(history), context, "Bearer t", backend=FakeBackend(), api=api)


def test_도구를_부르고_결과로_답한다():
    api = FakeAPI(reply(None, ("find_transactions", {"month": 9, "category": "카페", "merchant": None, "verdict": None, "around": None})),
                  reply("9월 카페 결제는 5건, 합계 40,800원입니다."))

    out = run(api, "9월에 카페에서 얼마 썼어?")

    assert out["answer"] == "9월 카페 결제는 5건, 합계 40,800원입니다." and out["proposals"] == []
    assert '"sum": 40800' in api.requests[1]["messages"][-1]["content"]
    first = api.requests[0]
    assert first["reasoning_effort"] == "none" and first["temperature"] == 0 and first["tool_choice"] == "auto"
    assert all(t["function"]["strict"] for t in first["tools"])
    assert "현재 화면: 질문(/questions)" in first["messages"][0]["content"]


def test_제안_카드를_실제_id_로_돌려준다():
    said = "SK텔레콤은 가족이랑 같이 쓰는 공용 회선이야"
    api = FakeAPI(reply(None, ("list_questions", {"merchant": "SK텔레콤", "date": None})),
                  reply(None, ("propose_answer", {"group": "g1", "value": "공용", "basis": "user_said", "quote": said})),
                  reply("SK텔레콤 회선을 공용으로 답하는 카드를 만들었습니다. 적용을 누르면 반영됩니다."))

    out = run(api, said)

    assert [p["questionIds"] for p in out["proposals"]] == [["q-skt"]]
    assert [c[0] for c in out["calls"]] == ["list_questions", "propose_answer"]


def test_검증에_걸리면_사유를_붙여_다시_쓰게_한다():
    api = FakeAPI(reply("합계는 45,000원이에요!"), reply("조회한 거래가 없어 합계를 말씀드릴 수 없습니다."))

    out = run(api, "얼마 썼어?")

    assert out["answer"] == "조회한 거래가 없어 합계를 말씀드릴 수 없습니다."
    feedback = api.requests[1]["messages"][-1]
    assert feedback["role"] == "user" and "45,000" in feedback["content"] and "느낌표" in feedback["content"]


def test_세_번_반려되면_정해_둔_문구로_답하고_제안은_버린다():
    said = "SK텔레콤은 공용이야"
    api = FakeAPI(reply(None, ("list_questions", {"merchant": None, "date": None})),
                  reply(None, ("propose_answer", {"group": "g1", "value": "공용", "basis": "user_said", "quote": said})),
                  *[reply("공용으로 바꿨어요!")] * 3)

    out = run(api, said)

    assert out == {**out, "answer": agent.FALLBACK, "proposals": []}
    assert len(api.requests) == 5


def test_LLM_이_실패해도_예외를_올리지_않는다():
    assert run(FakeAPI(RuntimeError("gateway down")), "안녕")["answer"] == agent.FALLBACK


def test_모델_설정이_없으면_LLM_을_부르지_않는다(monkeypatch):
    monkeypatch.setattr(settings, "assistant_model", None)
    api = FakeAPI()
    assert run(api, "안녕")["answer"] == agent.FALLBACK and api.requests == []


def test_도구_라운드_상한에서는_도구를_끄고_답하게_한다():
    status = ("get_status", {})
    api = FakeAPI(*[reply(None, status)] * agent.MAX_ROUNDS, reply("다음 할 일은 질문에 답하기입니다."))

    out = run(api, "다음엔 뭘 해?")

    assert out["answer"] == "다음 할 일은 질문에 답하기입니다."
    assert [r["tool_choice"] for r in api.requests] == ["auto"] * agent.MAX_ROUNDS + ["none"]


def test_strict_를_받지_않는_모델에는_끄고_보낸다(monkeypatch):
    monkeypatch.setattr(settings, "assistant_model", "anthropic/claude-haiku-5-5")
    monkeypatch.setattr(settings, "assistant_reasoning_effort", None)
    api = FakeAPI(reply("안녕하십니까. 무엇을 도와드릴까요?"))

    run(api, "안녕")

    assert not any("strict" in t["function"] for t in api.requests[0]["tools"])
    assert "reasoning_effort" not in api.requests[0] and api.requests[0]["temperature"] == 0


def test_깨진_인자는_결과로_돌려준다():
    bad = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
        content=None, tool_calls=[SimpleNamespace(id="c1", function=SimpleNamespace(name="get_help", arguments="{oops"))]))])
    api = FakeAPI(bad, reply("도움말을 찾지 못했습니다."))

    out = run(api, "도움말")

    assert out["calls"][0][2]["error"] == "BAD_ARGUMENTS"
