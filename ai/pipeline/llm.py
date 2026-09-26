"""LLM 호출. 임베딩과 다른 엔드포인트·다른 키를 쓴다."""

from __future__ import annotations

from openai import OpenAI
from pydantic import BaseModel

from app.config import settings

MODEL = "gpt-4o-mini"


def client() -> OpenAI:
    if not settings.agent_api_key or not settings.agent_base_url:
        raise SystemExit("AGENT_API_KEY / AGENT_BASE_URL 이 .env 에 없습니다")
    return OpenAI(
        api_key=settings.agent_api_key,
        base_url=settings.agent_base_url,
        max_retries=5,
        timeout=60,
    )


def structured[T: BaseModel](system: str, user: str, schema: type[T], api: OpenAI | None = None) -> T:
    """스키마를 강제해서 받는다. 파싱 실패를 호출부가 떠안지 않게 한다."""
    api = api or client()
    res = api.chat.completions.parse(
        model=MODEL,
        temperature=0,
        response_format=schema,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    out = res.choices[0].message.parsed
    if out is None:
        raise RuntimeError(f"구조화 출력 실패: {res.choices[0].message.refusal}")
    return out
