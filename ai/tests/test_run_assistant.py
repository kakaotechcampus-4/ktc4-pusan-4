"""비서 평가 하네스의 채점 부분. 모델 없이 돈다."""

from assistant.agent import FALLBACK
from assistant.tools import TOOL_DEFS
from eval.assistant_fake import QUESTIONS
from eval.run_assistant import grade, key, load_cases

SKT = {"kind": "answer", "questionIds": ["q-skt"], "value": "공용", "source": "ASSISTANT", "card": "…"}


def out(answer="합계는 40,800원입니다.", proposals=(), calls=()):
    return {"answer": answer, "proposals": list(proposals), "calls": [(c, "{}", {}) for c in calls]}


def test_제안을_채점용_표기로_바꾼다():
    assert key(SKT) == "answer q-skt 공용"
    assert key({"kind": "classification", "reviewIds": ["r-1", "r-2"], "merchantCategory": "해외SaaS"}) == "classification r-1,r-2 해외SaaS"
    assert key({"kind": "override", "judgmentId": "j-1", "toVerdict": "AVAILABLE", "reason": "…"}) == "override j-1 AVAILABLE"
    assert key({"kind": "handoff_note", "text": "…", "transactionIds": []}) == "handoff_note"


def test_기대를_모두_만족하면_통과한다():
    case = {"expect": {"proposals": ["answer q-skt 공용"], "called": ["list_questions"], "contains": ["40800"],
                       "not_matches": [r"\d+\s*%"]}}
    assert grade(case, out(proposals=[SKT], calls=["list_questions"])) == []


def test_어긋난_기대마다_사유를_준다():
    case = {"expect": {"proposals": [], "not_proposed": ["answer"], "called": ["get_status"], "contains": ["세무"]}}
    fails = grade(case, out(answer=FALLBACK, proposals=[SKT]))
    assert len(fails) == 5   # 정해 둔 문구 · 제안 불일치 · 금지 제안 · 미호출 · 문구 없음


def test_평가_셋이_가짜_백엔드와_도구에_맞는다():
    cases = load_cases()
    qids = {q[0] for q in QUESTIONS}
    assert len({c["id"] for c in cases}) == len(cases)
    for c in cases:
        assert set(c["expect"]) <= {"proposals", "not_proposed", "called", "contains", "not_matches"}
        assert set(c["expect"].get("called", [])) <= set(TOOL_DEFS)
        assert set(c.get("keep_questions", [])) <= qids
