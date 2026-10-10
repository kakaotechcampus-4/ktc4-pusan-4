"""LLM 호출. 임베딩과 다른 엔드포인트·다른 키를 쓴다."""

from __future__ import annotations

import logging

from langfuse import Langfuse
from langfuse.openai import OpenAI
from pydantic import BaseModel

from app.config import settings

# langfuse.openai 는 import 만으로 openai 를 전역 패치한다. 이 모듈을 import 한 프로세스는 임베딩도 기록된다.
if not settings.langfuse_public_key:
    logging.getLogger("langfuse").setLevel(logging.ERROR)
Langfuse(
    public_key=settings.langfuse_public_key,
    secret_key=settings.langfuse_secret_key,
    base_url=settings.langfuse_base_url,
    tracing_enabled=bool(settings.langfuse_public_key),
)


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
    effort = settings.agent_reasoning_effort
    extra = {"reasoning_effort": effort} if effort else {}
    # 추론을 켜면 temperature 는 기본값(1)만 받는다(gpt-6-luna 실측 400).
    if effort in (None, "none"):
        extra["temperature"] = 0
    res = api.chat.completions.parse(
        model=settings.agent_model,
        response_format=schema,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        name=schema.__name__,
        **extra,
    )
    out = res.choices[0].message.parsed
    if out is None:
        raise RuntimeError(f"구조화 출력 실패: {res.choices[0].message.refusal}")
    return out
