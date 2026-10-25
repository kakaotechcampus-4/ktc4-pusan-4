"""비서 최종 답 검증. 걸리면 사유를 붙여 다시 쓰게 한다(pipeline/select.py 와 같은 방식).

모델이 말을 지어내도 숫자·조문·말투는 코드로 잡는다. 모델을 바꿔도 같은 기준이 유지된다.
"""

import re

NUMBER = re.compile(r"\d[\d,]*\d")  # 두 자리 이상. 한 자리(9월, 3건)는 지어내도 피해가 작고 너무 흔하다
ARTICLE = re.compile(r"(\d+)\s*조(?!\s*원)")
CASUAL = re.compile(r"(어요|아요|예요|이에요|에요|해요|돼요|네요|죠)[.?!\s]|(어요|아요|예요|에요|해요|돼요|네요)$")
ALIAS = re.compile(r"(?<![A-Za-z0-9])[gtc]\d{1,2}(?![A-Za-z0-9])")
BANNED = ["AI 추천", "AI가 판단", "AI가 판정"]


def problems(answer: str, sources: list[str], citations: list[str]) -> list[str]:
    """반려 사유 목록. 비어 있으면 통과다.

    sources: 이 턴의 도구 결과, 사용자 메시지, 화면 맥락. citations: 이 턴에 get_judgment 로 받은 조문 제목.
    """
    out = []
    known = "|".join(sources + citations).replace(",", "")
    # shortcut: "4만 원" 같은 한글 숫자는 잡지 못한다. 평가에서 지어낸 한글 숫자가 보이면 정규화를 더한다.
    for n in NUMBER.findall(answer):
        if n.replace(",", "") not in known:
            out.append(f"도구 결과에 없는 숫자 {n}을 썼다. 숫자는 도구 결과에 있는 값만 쓰고 직접 계산하지 않는다.")
    for a in ARTICLE.findall(answer):
        if not any(f"제{a}조" in c for c in citations):
            out.append(f"판정에 붙지 않은 조문 제{a}조를 썼다. 조문은 get_judgment 로 받은 것만 쓴다.")
    if "!" in answer:
        out.append("느낌표를 썼다.")
    if "**" in answer or re.search(r"(?m)^\s*(#|[-*•]\s|\d+\.\s)", answer):
        out.append("마크다운(굵게, 목록 기호, 제목)을 썼다. 평범한 문장으로 쓴다.")
    if CASUAL.search(answer):
        out.append("'-요'체를 썼다. '-합니다'체로 쓴다.")
    if ALIAS.search(answer):
        out.append("g1, t3 같은 내부 별칭을 썼다. 가맹점·날짜·금액으로 말한다.")
    out += [f"'{b}'라는 표현은 쓰지 않는다." for b in BANNED if b in answer]
    return out
