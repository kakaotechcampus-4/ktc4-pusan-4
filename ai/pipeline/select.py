"""후보 청크에서 근거를 고른다 — CONTEXT.md 9.5 의 에이전트 ②.

검색은 위계를 안 가린다. 네 위계의 상위 k 가 한꺼번에 올라오고, 무엇이 실제
근거인지는 여기서 정한다. 순차 탐색과 조기 종료를 버린 자리가 이 함수다.

법령은 조 단위로 뽑혀 형제 잎이 각자 라벨을 달고 온다(search.pick). 호 하나만
떼어 보여주면 형제 호와 뒤따르는 항을 못 본다 — 소득세법 33조 제2항의 적용
순서 규칙이 그 예다. 인용은 라벨마다 제 본문으로만 검증한다.

모델이 낸 것을 코드가 두 가지 검증한다.
  statute_id 가 후보 안에 있는가    실재하는 딴 조문을 지어내는 걸 막는다
  quote 가 본문에 글자 그대로 있는가  인용 왜곡을 막는다
둘 다 CONTEXT.md 10 의 "확실한 방어"다. 근거 오적용만은 이걸로 못 막는다.

프롬프트는 후보를 위계별로 묶어 보여주기만 하고 "상위를 먼저 골라라"는 지시를
넣지 않는다. 심판례는 확인필요 결론의 정당한 근거라, 강요하면 쓸모 있는 사례를
버린다. 대신 확정 결론이 하위 근거만으로 서 있으면 needs_review 가 보류로 뺀다.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

from pipeline.llm import structured
from pipeline.search import Hit

# 이 위계만으로는 확정 결론을 세우지 않는다. 심판례·해석례·판례는 개별 사실관계에
# 대한 판단이라 일반 규칙으로 올리면 다른 사안까지 덮고, 위임 없는 훈령은 과세관청
# 내부만 구속해 납세자에게 대항력이 없다.
#
# doc_type 이 아니라 hierarchy 로 가른다 — 같은 행정규칙이어도 위임 고시는 대외적
# 구속력이 있어 확정 근거가 된다. 행정규칙 청크의 87.6%(4,703/5,366)가 훈령이라
# doc_type 으로 묶으면 당직근무규정으로 선 확정 결론이 그대로 나간다.
LOWER = {"훈령", "심판례", "해석례", "판례"}

# 심판례 심리판단은 최대 12만자다. 통째로 넣을 수 없고, 모델은 보여준 만큼만
# 인용할 수 있으니 quote 검증은 잘라내기 전 원문으로 해도 그대로 통과한다.
BODY_CHARS = 1200

RETRIES = 3

# 이보다 짧으면 공백을 지운 부분일치가 아무 데나 걸려 검증이 무의미해진다.
MIN_QUOTE = 10

# 모델이 호 번호 '2.' 를 '②' 로 바꿔 적는다(실측: 33-1-2 를 세 번 재시도해도 같았다).
# 번호는 구조지 인용 내용이 아니라 앞에서 떼고 대조한다.
_LEAD_NO = re.compile(r"^\s*(?:[①-⑳]|\d+(?:의\d+)*\.|[가-하]\.)\s*")

_TIER_NOTE = {
    "기본": "모든 지출에 항상 붙는다. 검색 결과가 아니다. 이 지출에 해당하는 조항만 인용해라",
    "법령": "법률·시행령·시행규칙. 구속력 있다",
    "행정규칙": "국세청 내부 해석기준. 법적 구속력은 없다",
    "심판례해석": "개별 사안에 대한 판단. 일반 규범이 아니다",
    "판례": "개별 사안에 대한 판단. 사실관계가 다르면 결론이 반대다",
}

SYSTEM = """너는 세무 규칙 카드 초안에 쓸 근거를 후보 중에서 고른다.
판정 대상은 개인사업자다. 법인 대상 규정은 이 사업자의 근거가 되지 않는다.

- 이 지출에 실제로 적용되는 것만 골라라. 주제가 비슷하다고 고르지 마라.
- 우리가 판정하는 건 종합소득세 필요경비다. 다른 세목(부가가치세 등) 조문은
  소득세법이 그것을 끌어다 쓸 때만 근거가 된다.
- 같은 이름의 문서가 둘 이상이면 어느 법 소관인지 본문에서 확인해라.
- statute_id 는 라벨로 적힌 것 중에서만 골라라. 라벨에 없는 조문은 후보가 아니다.
- quote 는 그 라벨 바로 아래 본문에서 그대로 복사해라. 한 글자도 바꾸지 마라.
  짧아도 된다. 한 문장이면 충분하다. 요약하거나 여러 줄을 이어 붙이지 마라.
- refs 에는 이 지출에 적용되는 것을 전부 넣어라. sufficient 와 상관없다.
- sufficient 는 그 근거들로 규칙 카드를 쓸 수 있느냐다. 모자라도 refs 는 채워라.
- refs 를 비우는 건 후보 중 어느 것도 이 지출에 적용되지 않을 때뿐이다.
- direction 은 고른 근거가 가리키는 결론이다. 조건에 따라 갈리면 확인필요다.
- note 는 단서와 적용 조건을 한 줄로 적어라. 세무 검수자가 읽는다."""


class StatuteRef(BaseModel):
    statute_id: str
    quote: str


class Evidence(BaseModel):
    """고른 근거. 그대로 rule_candidate.suggested_docs 로 간다.

    confidence 를 두지 않는다. 모델의 자기 확신도는 정확도와 잘 안 맞고 특히
    "확신하며 틀리는 경우"를 못 거른다(CONTEXT.md 10).
    """

    sufficient: bool
    refs: list[StatuteRef]
    direction: Literal["가능", "불가", "확인필요"]
    note: str


def _candidates(by_tier: dict[str, list[Hit]]) -> str:
    """ID 한 줄에 본문 한 덩이. 앞 잎과 겹치는 머리말 줄은 다시 찍지 않는다.

    ID 여럿을 한 줄에 묶고 본문을 한 덩이만 두면 모델이 어느 문장이 어느 호
    소속인지 못 맞춘다(실측: 시행령 문구를 법률 ID 로 인용해 검증 실패 2건).
    머리말을 잎마다 되풀이하면 "…산입하지 아니한다" 가 호마다 붙어 모든 호가 해당하는
    것처럼 보인다(실측: 33조 잎 17개를 통째로 인용). 검증은 생략 전 본문(_pool)으로 한다.
    """
    out = []
    for tier, hits in by_tier.items():
        if not hits:
            continue
        out.append(f"[{tier}] {_TIER_NOTE.get(tier, '')}")
        prev: list[str] = []
        for h in hits:
            sec = f" ({h.section})" if h.section else ""
            lines = h.body[:BODY_CHARS].strip().split("\n")
            same = 0
            while same < min(len(prev), len(lines) - 1) and prev[same] == lines[same]:
                same += 1
            out.append(f"  {h.statute_id}{sec}")
            out += [f"    {line}" for line in lines[same:]]
            prev = lines
        out.append("")
    return "\n".join(out)


def _norm(s: str) -> str:
    """공백을 지우고 비교한다. 띄어쓰기만 다른 인용은 왜곡이 아니다.

    청크 본문은 조 제목·항 도입문·호 내용이 개행으로 이어져 있는데, 모델이 한
    문장으로 옮기면 그 자리가 공백이 되거나 아예 붙는다("특례) ⑦" -> "특례)⑦").
    글자 순서가 같으면 요약도 창작도 아니므로 통과시킨다.

    대신 너무 짧은 인용은 이렇게 하면 아무 데나 걸린다. MIN_QUOTE 가 막는다.
    """
    return "".join(s.split())


def _pool(by_tier: dict[str, list[Hit]]) -> dict[str, list[str]]:
    """statute_id 하나에 본문이 여럿일 수 있다(심판례는 요지·심리판단이 같은 id).

    라벨마다 제 본문만 넣는다 — 조 전문까지 인용처로 두면 형제 호 본문을 엉뚱한
    호 ID 로 인용해도 통과한다.
    """
    out = defaultdict(list)
    for hits in by_tier.values():
        for h in hits:
            out[h.statute_id].append(h.body)
    return out


def _check(ev: Evidence, pool: dict[str, list[str]]) -> list[str]:
    """모델 출력에서 기계로 잡히는 것만. 근거 오적용은 여기서 안 걸린다."""
    bad = []
    if ev.sufficient and not ev.refs:
        bad.append("sufficient 가 true 인데 refs 가 비었다.")
    for r in ev.refs:
        chunks = pool.get(r.statute_id) or []
        quote = _norm(_LEAD_NO.sub("", r.quote))
        if len(quote) < MIN_QUOTE:
            bad.append(f"{r.statute_id} 의 인용문이 너무 짧다. 한 문장을 통째로 복사해라.")
        elif not chunks:
            bad.append(f"{r.statute_id} 는 후보에 없다. 후보 밖 조문은 근거가 될 수 없으니 빼고 결론을 다시 세워라.")
        elif not any(quote in _norm(b) for b in chunks):
            bad.append(
                f"{r.statute_id} 의 인용문 \"{r.quote[:40]}...\" 가 본문에 없다."
                " 요약하지 말고 한 문장을 그대로 복사해라."
            )
    return bad


def select(row: str, by_tier: dict[str, list[Hit]], api: OpenAI | None = None) -> Evidence:
    """row 는 pipeline.query.context() 가 만든 집계 블록."""
    pool = _pool(by_tier)
    user = f"{row}\n\n후보\n{_candidates(by_tier)}"
    for _ in range(RETRIES):
        ev = structured(SYSTEM, user, Evidence, api)
        bad = _check(ev, pool)
        if not bad:
            return ev
        user += "\n\n앞선 답이 아래 이유로 반려됐다. 고쳐서 다시 내라.\n- " + "\n- ".join(bad)
    raise ValueError("근거 선택 검증 실패: " + "; ".join(bad))


def needs_review(ev: Evidence, by_tier: dict[str, list[Hit]]) -> bool:
    """확정 결론이 하위 근거만으로 서 있으면 보류 큐로 보낸다. 거부가 아니다.

    대외적 구속력이 있는 근거 없이 선 초안이라는 표시다. 세무 검수자가 주당 수십 건
    중에 뭘 먼저 볼지 정하는 키가 된다.
    """
    if ev.direction == "확인필요":
        return False
    hier = {h.statute_id: h.hierarchy for hits in by_tier.values() for h in hits}
    return bool(ev.refs) and {hier[r.statute_id] for r in ev.refs} <= LOWER
