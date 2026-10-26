"""비서 도구. 가짜 백엔드로 LLM 없이 돈다."""

import json
from urllib.error import HTTPError

import pytest
import yaml

from app.config import ROOT
from assistant import tools
from assistant.tools import TOOL_DEFS, Turn, tool_specs
from eval.assistant_fake import BATCH, YEAR, FakeBackend

ALL = list(TOOL_DEFS)


def turn(fake=None, user="", **context) -> Turn:
    return Turn(fake or FakeBackend(), {"batchId": BATCH, "year": YEAR, **context}, [user], ALL)


def failing(fake: FakeBackend, failed_path: str, code: int) -> FakeBackend:
    orig = fake.get

    def get(path, **params):
        if path == failed_path:
            raise HTTPError(path, code, "", None, None)  # type: ignore[arg-type]
        return orig(path, **params)

    fake.get = get
    return fake


def test_strict_스키마_규칙을_지킨다():
    for spec in tool_specs(ALL, strict=True):
        params = spec["function"]["parameters"]
        assert spec["function"]["strict"] is True
        assert params["additionalProperties"] is False
        assert params["required"] == list(params["properties"])
    assert "strict" not in tool_specs(ALL, strict=False)[0]["function"]


def test_목록이_잘려도_건수와_합계는_전체_기준이다(monkeypatch):
    fake = FakeBackend()
    fake.transactions += [[f"x{i:03}", "2026-09-01", "메가커피", "메가커피", "카페", 1000, "NEEDS_REVIEW"] for i in range(130)]

    out = turn(fake).find_transactions(9, "카페", None, None, None)

    assert out["count"] == 135
    assert out["sum"] == 40800 + 130000
    assert len(out["items"]) == tools.LIST_LIMIT
    assert [c[1]["page"] for c in fake.calls if c[0] == "/transactions"] == [0, 1]   # 100건씩 두 쪽


def test_around_는_같은_날_거래를_준다():
    t = turn()
    ref = t.find_transactions(None, None, "전포", None, None)["items"][0]["ref"]

    out = t.find_transactions(None, None, None, None, ref)

    assert sorted(x["merchant"] for x in out["items"]) == ["스타벅스 전포점", "한국전력공사"]
    assert all(x["date"] == "2026-09-16(수)" for x in out["items"])


def test_진행_상황에_수입_이메일이_새지_않는다():
    fake = FakeBackend()
    fake.progress["context"] |= {"email": "me@example.com", "annualIncome": 48000000, "name": "홍길동"}

    out = json.dumps(turn(fake).run("get_status", {}), ensure_ascii=False)

    assert "example.com" not in out and "48000000" not in out and "홍길동" not in out
    assert "복식부기" in out


def test_질문_목록은_소명_대기와_지난번_답_A등급을_표시한다():
    t = turn()
    groups = {g["merchant"] + g["transactions"][0]["date"]: g for g in t.list_questions(None, None)["groups"]}

    saturday = groups["스타벅스2026-09-12(토)"]
    assert saturday["presumed_personal"] is True
    skt, kepco = groups["SK텔레콤2026-09-15(화)"], groups["한국전력2026-09-16(수)"]
    assert t.tier_a == {skt["ref"]: "전용", groups["노션2026-09-03(목)"]["ref"]: "업무 전용"}
    assert kepco["previous"]["conflict"] is True     # 충돌이면 A등급이어도 근거가 못 된다


def test_지난번_답_조회가_실패해도_질문_목록은_준다():
    out = turn(failing(FakeBackend(), "/questions/suggestions", 404)).list_questions(None, None)

    assert out["previous_unavailable"] is True and out["total_groups"] == 9


def test_판정_상세는_조문을_기록하고_원문을_준다():
    t = turn()
    ref = t.find_transactions(None, None, "SK에너지", None, None)["items"][0]["ref"]

    out = t.get_judgment(ref)

    assert out["verdict"] == "불가"
    assert out["citations"][0]["body"].startswith("가사")
    assert t.citations == ["소득세법 제33조 제1항 제5호"]


def test_보고_있는_거래는_t1_으로_시작한다():
    t = turn(transactionId="tx08")
    assert t.viewing == "t1"
    assert t.get_judgment("t1")["verdict"] == "불가"


@pytest.mark.parametrize(("name", "args", "error"), [
    ("get_judgment", {"transaction": "t99"}, "UNKNOWN_REF"),
    ("get_judgment", {"transaction": "g1"}, "UNKNOWN_REF"),
    ("get_help", {"topic": "없는주제"}, "UNKNOWN_TOPIC"),
    ("propose_magic", {}, "UNKNOWN_TOOL"),
])
def test_잘못된_호출은_예외가_아니라_결과로_돌려준다(name, args, error):
    assert turn().run(name, args)["error"] == error


def test_백엔드_오류는_결과로_돌려준다():
    assert turn(failing(FakeBackend(), "/progress", 503)).run("get_status", {}) == {
        "error": "BACKEND_ERROR", "status": 503, "message": "백엔드가 요청을 거절했습니다. 다시 부르지 말고 사용자에게 알리세요."}


def test_요약은_판정을_한국어_라벨로_준다():
    out = turn().get_summary(None)
    assert out["scope"] == "batch"
    assert out["by_verdict"]["가능"] == {"count": 3, "finalAmount": 577600}
    assert out["unclassified"] == {"count": 2, "amount": 97000}


def test_미분류_그룹은_후보_카테고리를_준다():
    out = turn().list_unclassified(None)
    assert out["groups"][0]["ref"] == "c1"
    assert out["groups"][0]["suggested"] == ["해외SaaS", "온라인쇼핑", "기타"]


# ── 제안 도구 ────────────────────────────────────────────────────
def groups_of(t: Turn) -> dict[str, str]:
    """질문 id → 그룹 ref"""
    t.list_questions(None, None)
    return {g["questionIds"][0]: ref for ref, g in t.refs.items() if ref.startswith("g")}


def test_말로_답하면_실제_질문_id_로_바꾼_카드를_만든다():
    t = turn(user="SK텔레콤은 가족이랑 같이 쓰는 공용 회선이야")
    g = groups_of(t)["q-skt"]

    out = t.propose_answer(g, "공용", "user_said", "SK텔레콤은 가족이랑 같이 쓰는 공용 회선이야.")

    assert out == {"status": "proposed", "card": "SK텔레콤 9/15 78,000원 → '공용'"}
    assert t.proposals == [{"kind": "answer", "questionIds": ["q-skt"], "value": "공용", "source": "ASSISTANT",
                            "card": "SK텔레콤 9/15 78,000원 → '공용'"}]


def test_지난번_답은_A등급이고_충돌이_없고_같은_값일_때만_된다():
    t = turn()
    g = groups_of(t)

    assert t.propose_answer(g["q-notion"], "업무 전용", "previous_answer", None)["status"] == "proposed"
    assert t.proposals[0]["source"] == "PREVIOUS_ANSWER"
    assert t.run("propose_answer", {"group": g["q-skt"], "value": "공용", "basis": "previous_answer"})["error"] == "NO_BASIS"
    assert t.run("propose_answer", {"group": g["q-kepco"], "value": "사업 전용", "basis": "previous_answer"})["error"] == "NO_BASIS"


def test_list_questions_없이는_지난번_답을_쓸_수_없다():
    t = turn()
    g = groups_of(turn())["q-skt"]   # 다른 턴에서 본 ref
    t.refs[g] = {"options": ["전용"], "bulkAnswerable": True}
    assert t.run("propose_answer", {"group": g, "value": "전용", "basis": "previous_answer"})["error"] == "NO_BASIS"


@pytest.mark.parametrize(("user", "qid", "value", "basis", "quote", "error"), [
    ("", "q-skt", "업무", "user_said", "업무", "INVALID_OPTION"),
    ("SK텔레콤은 공용이야", "q-skt", "공용", "user_said", "개인 회선이야", "QUOTE_NOT_FOUND"),
    ("SK텔레콤은 공용이야", "q-skt", "공용", "user_said", None, "QUOTE_NOT_FOUND"),
    ("", "q-sb-0912", "업무미팅", "previous_answer", None, "NEEDS_USER_STATEMENT"),
    ("토요일 스타벅스는 클라이언트 미팅이었어", "q-sb-0912", "업무미팅", "user_said", "토요일 스타벅스는 클라이언트 미팅이었어", "AMBIGUOUS_TARGET"),
    ("2일 스타벅스는 미팅", "q-sb-0912", "업무미팅", "user_said", "2일 스타벅스는 미팅", "AMBIGUOUS_TARGET"),  # 12일이 아니다
    ("남은 질문 전부 개인이야", "q-skt", "개인", "user_said", "전부 개인이야", "AMBIGUOUS_TARGET"),  # 일괄 규칙 우회
])
def test_근거가_없는_답_제안은_거절한다(user, qid, value, basis, quote, error):
    t = turn(user=user)
    out = t.run("propose_answer", {"group": groups_of(t)[qid], "value": value, "basis": basis, "quote": quote})
    assert out["error"] == error and not t.proposals


@pytest.mark.parametrize("quote", ["9월 12일 토요일 스타벅스는 거래처 미팅이었습니다", "12,800원 나온 스타벅스는 미팅이었어", "9/12 스타벅스 미팅"])
def test_소명_대기는_날짜나_금액으로_그_건을_특정하면_된다(quote):
    t = turn(user=quote)
    assert t.propose_answer(groups_of(t)["q-sb-0912"], "업무미팅", "user_said", quote)["status"] == "proposed"
    assert t.proposals[0]["questionIds"] == ["q-sb-0912"]


def keep_questions(*qids: str) -> FakeBackend:
    fake = FakeBackend()
    fake.questions = [q for q in fake.questions if q[0] in qids]
    return fake


def test_일괄_답은_남은_그룹이_많으면_거절한다():
    t = turn(user="남은 질문 전부 개인이야")
    assert t.run("propose_bulk_answer", {"fact_type": "용도", "value": "개인", "quote": "전부 개인이야"})["error"] == "BULK_NOT_YET"


def test_일괄_답은_모두가_받는_선택지로_대상_건수와_합계를_보여_준다():
    t = turn(keep_questions("q-sb-jeonpo", "q-pg", "q-skt"), user="남은 용도 질문은 전부 개인이야")

    out = t.propose_bulk_answer("용도", "개인", "전부 개인이야")

    assert out["card"] == "남은 '용도' 질문 2건 39,800원 → '개인'"
    assert t.proposals[0] | {"card": None} == {"kind": "bulk_answer", "batchId": BATCH, "factType": "용도",
                                               "value": "개인", "card": None}
    assert t.run("propose_bulk_answer", {"fact_type": "용도", "value": "업무미팅", "quote": "전부 개인이야"})["allowed"] == ["개인"]


@pytest.mark.parametrize(("qids", "fact", "error"), [
    (("q-sb-0912", "q-sb-jeonpo", "q-pg"), "용도", "PRESUMED_MIXED"),   # 소명 대기가 섞이면 한 번에 답하지 않는다
    (("q-skt", "q-adobe"), "결제기간", "USE_ANSWER"),
    (("q-skt", "q-adobe"), "용도", "NOTHING_TO_ANSWER"),
])
def test_일괄_답을_만들_수_없는_경우(qids, fact, error):
    t = turn(keep_questions(*qids), user="전부 개인")
    assert t.run("propose_bulk_answer", {"fact_type": fact, "value": "개인", "quote": "전부 개인"})["error"] == error


def test_분류_제안은_후보_안이거나_사용자_설명이_근거여야_한다():
    t = turn(user="XYZ PAYMENTS는 디자인 툴 결제라 국내 소프트웨어야. 나머지도 다 기타야")
    c = t.list_unclassified(None)["groups"][0]["ref"]

    assert t.run("propose_classification", {"group": c, "category": "국내SW", "basis": "suggested_category"})["error"] == "NO_BASIS"
    assert t.run("propose_classification", {"group": c, "category": "없는것", "basis": "suggested_category"})["error"] == "INVALID_CATEGORY"
    assert t.propose_classification(c, "해외SaaS", "suggested_category", None)["status"] == "proposed"
    assert t.run("propose_classification", {"group": c, "category": "기타", "basis": "user_said", "quote": "나머지도 다 기타야"})["error"] == "AMBIGUOUS_TARGET"
    quote = "XYZ PAYMENTS는 디자인 툴 결제라 국내 소프트웨어야"
    assert t.propose_classification(c, "국내SW", "user_said", quote)["card"] == "XYZ PAYMENTS 2건 97,000원 → 국내SW"
    assert [p["reviewIds"] for p in t.proposals] == [["r-tx17", "r-tx18"]] * 2


def test_판정_수정은_질문이_남은_거래면_질문으로_돌린다():
    t = turn(user="전포점 스타벅스는 가능으로 바꿔 줘. 업무미팅이었어")
    ref = t.find_transactions(None, None, "전포", None, None)["items"][0]["ref"]
    out = t.run("propose_override", {"transaction": ref, "to_verdict": "가능", "quote": "업무미팅이었어"})
    assert out["error"] == "USE_QUESTION" and not t.proposals


def test_판정_수정_카드는_현재_판정_id_와_사용자_문장을_사유로_담는다():
    t = turn(user="넷플릭스는 강의 자료 조사용이라 업무용이야. 판정 바꿔 줘")
    ref = t.find_transactions(None, None, "넷플릭스", None, None)["items"][0]["ref"]

    assert t.run("propose_override", {"transaction": ref, "to_verdict": "불가", "quote": "넷플릭스는"})["error"] == "SAME_VERDICT"
    assert t.run("propose_override", {"transaction": ref, "to_verdict": "가능", "quote": "판정 바꿔 줘"})["error"] == "AMBIGUOUS_TARGET"
    out = t.propose_override(ref, "가능", "넷플릭스는 강의 자료 조사용이라 업무용이야")

    assert out["card"] == "넷플릭스 9/28 17,000원 판정 불가 → 가능"
    assert t.proposals[0] | {"card": None} == {"kind": "override", "judgmentId": "j-tx08", "toVerdict": "AVAILABLE",
                                               "reason": "넷플릭스는 강의 자료 조사용이라 업무용이야", "card": None}


def test_세무대리인_질문은_사용자가_물은_문장이_있어야_한다():
    t = turn(user="노트북 사려는데 경비로 넣으면 세금이 얼마나 줄어요?", transactionId="tx07")
    note = "업무용 노트북 구입비를 경비로 처리할 수 있는지, 처리 방식은 무엇인지"

    assert t.run("add_handoff_note", {"text": note, "transactions": [], "quote": "노트북 사 줘"})["error"] == "QUOTE_NOT_FOUND"
    t.add_handoff_note(note, ["t1"], "경비로 넣으면 세금이 얼마나 줄어요")
    assert t.proposals[0]["transactionIds"] == ["tx07"] and t.proposals[0]["text"] == note


def test_화면_이동_카드는_화면_이름을_보여_준다():
    t = turn()
    assert t.propose_navigation("/summary")["card"] == "요약 화면으로 이동"
    assert t.run("propose_navigation", {"route": "/run"})["error"] == "INVALID_ROUTE"


def test_카테고리_사본이_원본과_같다():
    assert tools.CATEGORIES == yaml.safe_load((ROOT / "rules" / "categories.yaml").read_text(encoding="utf-8"))["categories"]


def test_화면별_도구는_9개_이하이고_모두_정의돼_있다():
    for screen in [*tools.SCREEN_TOOLS, "/upload", None]:
        names = tools.tools_for(screen)
        assert len(names) <= 9 and len(set(names)) == len(names) and set(names) <= set(TOOL_DEFS)
    assert set().union(*(tools.tools_for(s) for s in [*tools.SCREEN_TOOLS, None])) == set(TOOL_DEFS)
    assert tools.tools_for("/results/abc") == tools.tools_for("/results")


def test_화면에_없는_도구는_부를_수_없다():
    t = Turn(FakeBackend(), {"batchId": BATCH}, ["공용이야"], tools.tools_for("/upload"))
    assert t.run("propose_answer", {"group": "g1", "value": "공용", "basis": "user_said", "quote": "공용이야"})["error"] == "UNKNOWN_TOOL"
