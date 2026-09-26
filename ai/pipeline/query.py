"""미판정 집계 한 줄을 검색 질의로 바꾼다.

`unmatched_log` 집계 행은 (카테고리 × 업종코드 × 사유)이지 검색 질의가 아니다.
카테고리는 우리 내부 분류 어휘라 조문에는 그 단어가 아예 없다 — 실측으로
'카페'를 그대로 임베딩하면 정답 조문이 법령 15,613건 중 2740위이고,
'거래처 접대 교제 비용의 필요경비 불산입'으로 물으면 8위다.

CONTEXT.md 9.5 의 에이전트 ① 이다. 규칙 후보 추출과 보고서 생성이 같은 함수를 쓴다.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel

from pipeline.llm import structured

ROOT = Path(__file__).resolve().parents[2]
CATEGORIES = ROOT / "docs" / "categories.md"


class SearchPlan(BaseModel):
    """집계 한 줄을 검색 입력으로 바꾼 것.

    두 쪽이 원하는 질의 길이가 반대라 나눠 받는다. 벡터는 문맥이 붙을수록 잘 찾고
    LIKE 는 글자가 그대로 본문에 있어야 해서, 한 문자열로 둘 다 하면 키워드 쪽이
    한 건도 안 걸린다(실측: 고정질의 10건 전부 0건).

    질의가 복수인 건 한 카테고리가 서로 다른 조문으로 갈리기 때문이다. 음식점은
    거래처를 동반했으면 기업업무추진비고 대표자 본인 식대면 가사 관련 경비다.
    """

    queries: list[str]
    keywords: list[str]


SYSTEM = """너는 한국 소득세법 조문을 찾는 검색 입력을 만든다.
가맹점 카테고리는 우리 내부 분류 어휘라 조문에는 그 단어가 없다.
그 지출이 세법에서 무엇으로 다뤄지는지를 조문에 실제로 쓰이는 법률 용어로 바꿔라.

queries — 의미 검색용. 1~3개.
- 서술문을 쓰지 마라. 조문 제목처럼 명사구로 써라.
- 30자 안쪽. 핵심 법률 용어 2~3개만 남겨라.
- 한 지출이 서로 다른 조문으로 갈릴 수 있으면 갈래마다 하나씩 써라.
- 조문 번호나 법령 이름은 쓰지 마라.

keywords — 정확 일치 검색용. 1~3개.
- 조문 본문에 그 글자 그대로 있을 법한 법률 용어만 골라라.
- 2~10자. 조사나 어미를 붙이지 마라.
- 자신 없으면 개수를 줄여라. 안 맞는 말은 검색을 흐린다.

예) 광고
  queries  ["광고선전비의 필요경비 산입"]
  keywords ["광고선전비"]"""


def category_meta() -> dict[str, str]:
    """카테고리별 세무 성격. docs/categories.md 표에서 읽는다.

    그 파일은 tools/validate_rules.py 의 CATEGORY_META 에서 자동 생성된다.
    "거래처 미팅이면 가능"이 기업업무추진비로, "100만원 초과면 비품(자산)"이
    즉시상각의 의제로 이어주는 다리다.
    """
    meta = {}
    for line in CATEGORIES.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 4 and cells[0].startswith("`"):
            meta[cells[0].strip("`")] = f"{cells[2]} {cells[3]}".strip()
    return meta


def context(
    category: str, industry_code: str, reason: str, meta: dict[str, str] | None = None
) -> str:
    """집계 한 줄을 프롬프트에 넣을 블록으로. 질의 작성과 근거 선택이 같이 쓴다."""
    meta = category_meta() if meta is None else meta
    fields = [
        f"카테고리: {category}",
        f"성격: {meta.get(category, '')}",
        f"업종코드: {industry_code}",
        f"미판정 사유: {reason}",
    ]
    return "\n".join(fields)


def rewrite(
    category: str, industry_code: str, reason: str, meta: dict[str, str] | None = None
) -> SearchPlan:
    return structured(SYSTEM, context(category, industry_code, reason, meta), SearchPlan)
