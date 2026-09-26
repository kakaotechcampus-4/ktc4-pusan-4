"""임베딩 호출. 게이트웨이가 OpenAI 호환이라 base_url 만 갈아끼운다."""

from __future__ import annotations

from collections.abc import Iterator, Sequence

from openai import OpenAI

from app.config import settings

MODEL = "text-embedding-3-small"
DIM = 1536

# 건수만으로 끊으면 안 된다. 청크 상한이 5,000자라 100건이면 50만 자가 되고,
# 게이트웨이의 요청당 30만 토큰 상한에 걸려 400 이 돌아온다.
BATCH = 100
BATCH_CHARS = 100_000


def client() -> OpenAI:
    # 키가 캠퍼스 게이트웨이 JWT라 base_url 을 안 넘기면 OpenAI 본사로 가서 401 이다.
    # pydantic-settings 는 os.environ 을 채우지 않으므로 SDK 의 환경변수 자동 인식도 못 믿는다.
    if not settings.embedding_api_key or not settings.embedding_base_url:
        raise SystemExit("EMBEDDING_API_KEY / EMBEDDING_BASE_URL 이 .env 에 없습니다")
    return OpenAI(
        api_key=settings.embedding_api_key,
        base_url=settings.embedding_base_url,
        max_retries=5,
        timeout=60,
    )


def batches(texts: Sequence[str]) -> Iterator[list[str]]:
    part: list[str] = []
    size = 0
    for text in texts:
        if part and (len(part) >= BATCH or size + len(text) > BATCH_CHARS):
            yield part
            part, size = [], 0
        part.append(text)
        size += len(text)
    if part:
        yield part


def embed(texts: Sequence[str], api: OpenAI | None = None) -> list[list[float]]:
    api = api or client()
    out: list[list[float]] = []
    for part in batches(texts):
        res = api.embeddings.create(model=MODEL, input=part)
        out.extend(d.embedding for d in sorted(res.data, key=lambda d: d.index))
    if out and len(out[0]) != DIM:
        raise SystemExit(f"차원이 {len(out[0])}이다. legal_chunk.embedding 은 vector({DIM})")
    return out
