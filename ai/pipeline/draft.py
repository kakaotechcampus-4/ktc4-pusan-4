"""고른 근거로 규칙 카드 초안을 쓴다 — CONTEXT.md 9.5 의 에이전트 ③.

산출물은 rules/cards/*.yaml 이 아니라 rule_candidate.draft_yaml 이다. 사람이
승인해야 PR 이 되고 CI(RuleCardLoader + EvalHarnessTest)를 통과해야 카드가 된다.

모델이 정하는 건 gate·verdict·account 셋뿐이다. 나머지는 코드가 박는다.

  citations         Evidence.refs 를 그대로 옮긴다. 인용 검증을 통과한 걸 모델이
                    다시 쓰게 하면 그 자리가 재창작이 된다
  match             집계 행이 이미 안다. 다시 쓰게 하면 오타만 들어온다
  priority          410. 학습룰 대역 바로 위라 손으로 쓴 어떤 카드에도 진다(R-214)
  id·effective_period  승인 시점에 박는다. 기본은 소급 적용 안 함
  version·review    상수

question·attributes·out_of_scope 는 모델이 쓰지 않는다. 조문에서 나오는 값이
아니라 제품 결정이다 — 무엇을 물을 수 있는지, 우리 범위 밖인지는 근거가 안 정한다.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

import psycopg
from openai import OpenAI
from pydantic import BaseModel

from pipeline.llm import structured
from pipeline.select import Evidence

# 학습룰 대역(400 이하) 바로 위. 초안은 안전망이라 어떤 카드에든 져야 한다.
PRIORITY = 410

# 판정을 막는 관문. 로더가 verdict 를 요구한다(docs/rule-card-fields.md).
BLOCKING = ("G1", "G2")

RETRIES = 3

SYSTEM = """너는 세무 규칙 카드의 초안을 쓴다. 근거는 이미 골라져 있다. 셋만 정해라.

gate — 어느 관문이 이 지출을 판정하나. 가맹점 카테고리 단위 카드는 거의 G1 아니면 G2 다.
  G1  소득세법 33조가 이름을 대고 막은 것. 소득세·벌금·과태료처럼 열거돼 있다
  G2  경비로 인정할지를 사업 관련성으로 가리는 것. 대부분 여기다
  G3  이미 인정된 건의 업무/가사 비율을 나누는 것.
      인정 여부 자체를 다투는 중이면 G3 가 아니라 G2 다
  G4  자산으로 잡아 감가상각할지
  G5  증빙을 갖췄는지. 판정을 바꾸지 않고 가산세만 따진다
  G6  연간 한도가 걸린 것

verdict — 가능 / 불가 / 확인필요
  차단형(G1·G2)은 반드시 값을 내라.
  속성 관문(G3~G6)은 판정을 바꾸지 않으므로 대개 비운다.
  근거만으로 확정되지 않고 사실관계에 따라 갈리면 확인필요다.

account — 계정과목. 확실하지 않으면 비워라. 지어내지 마라."""


class RuleCardDraft(BaseModel):
    gate: Literal["G1", "G2", "G3", "G4", "G5", "G6"]
    verdict: Literal["가능", "불가", "확인필요"] | None
    account: str | None


def missing_statutes(conn: psycopg.Connection, ids: list[str]) -> list[str]:
    """인용된 조문 중 현행 원문에 없는 것.

    청크는 statute_version 에서 나오지만 재색인 사이에 조문이 닫혔을 수 있다.
    비어 있지 않으면 색인이 원문보다 낡았다는 뜻이라 초안을 보류로 보낸다.
    """
    if not ids:
        return []
    found = {
        r["statute_id"]
        for r in conn.execute(
            "SELECT statute_id FROM statute_version"
            " WHERE statute_id = ANY(%s) AND effective_to IS NULL",
            (ids,),
        ).fetchall()
    }
    return [i for i in ids if i not in found]


def _check(card: RuleCardDraft, ev: Evidence) -> list[str]:
    """카드가 스스로 모순인 경우만. 게이트가 옳은지는 기계가 못 본다."""
    bad = []
    if card.gate == "G1" and not any(r.statute_id.startswith("소득세법-33-") for r in ev.refs):
        bad.append(
            "G1 은 소득세법 33조가 이름을 대고 막은 것뿐이다."
            " 고른 근거에 33조가 없으면 G1 이 아니다."
        )
    if card.gate in BLOCKING and card.verdict is None:
        bad.append(f"{card.gate} 는 차단형이라 verdict 가 있어야 한다.")
    return bad


def draft(row: str, ev: Evidence, api: OpenAI | None = None) -> RuleCardDraft:
    """row 는 pipeline.query.context() 가 만든 집계 블록."""
    lines = [row, "", "고른 근거"]
    for r in ev.refs:
        lines.append(f"  {r.statute_id}")
        lines.append(f"    {r.quote}")
    lines += ["", f"근거 요지: {ev.note}", f"결론 방향: {ev.direction}"]
    user = "\n".join(lines)
    for _ in range(RETRIES):
        card = structured(SYSTEM, user, RuleCardDraft, api)
        bad = _check(card, ev)
        if not bad:
            return card
        user += "\n\n앞선 답이 아래 이유로 반려됐다. 고쳐서 다시 내라.\n- " + "\n- ".join(bad)
    raise ValueError("초안 검증 실패: " + "; ".join(bad))


def render(
    card: RuleCardDraft,
    ev: Evidence,
    category: str,
    industry_code: str,
    today: date,
) -> str:
    """rule_candidate.draft_yaml 에 들어갈 본문. 필드는 docs/rule-card-fields.md 를 따른다.

    yaml.dump 를 쓰지 않는다. 카드가 흐름 스타일(`{ start: ..., end: null }`)로
    쓰여 있어서 덤프하면 리포의 다른 카드와 모양이 어긋난다.
    """
    seen: dict[str, None] = dict.fromkeys(r.statute_id for r in ev.refs)
    out = []
    if ev.note:
        # 줄마다 붙인다. 첫 줄에만 붙이면 모델이 두 줄로 쓸 때 둘째 줄이 주석 밖으로
        # 나가 카드 전체가 YAML 로 안 읽힌다.
        out += [f"# {line}" for line in ev.note.splitlines()] + ["#"]
    out += [
        "# 자동 생성 초안이다. 세무 검수 전이고 아직 카드가 아니다.",
        "# id 와 effective_period.start 는 승인 시점에 박는다(기본은 소급 적용 안 함).",
        "id: TODO",
        "version: 1",
        f"gate: {card.gate}",
        f"priority: {PRIORITY}",
        "effective_period: { start: TODO, end: null }",
        "match:",
        f"  category: [{category}]",
        f'  industry: ["{industry_code}"]',
    ]
    if card.verdict:
        out.append(f"verdict: {card.verdict}")
    if card.account:
        out.append(f"account: {card.account}")
    if seen:
        out.append("citations:")
        out += [f"  - {{ id: {sid}, verified: true }}" for sid in seen]
    out.append(f"review: {{ by: 미검수, date: {today} }}")
    return "\n".join(out) + "\n"
