import threading
from typing import Literal

import psycopg
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from assistant import agent
from classify import decisions

app = FastAPI(title="ktc4-pusan4-ai")
# 도구가 백엔드 경로에 넣는 값이다. 경로를 벗어나는 문자를 막는다.
ID = r"^[0-9A-Za-z-]{1,64}$"
# shortcut: 프로세스 안의 한도라 uvicorn 워커를 늘리면 배수가 된다. 워커를 늘릴 때 공유 카운터로 옮긴다.
assistant_slots = threading.BoundedSemaphore(8)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/db")
def health_db():
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
    except psycopg.Error as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"status": "ok"}


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatContext(BaseModel):
    screen: str | None = Field(None, max_length=200)
    batchId: str | None = Field(None, pattern=ID)
    transactionId: str | None = Field(None, pattern=ID)
    year: int | None = Field(None, ge=2000, le=2100)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[Message] = Field(default_factory=list, max_length=20)
    context: ChatContext = Field(default_factory=ChatContext)
    sessionId: str | None = Field(None, pattern=r"^[A-Za-z0-9_-]{1,64}$")


class ChatResponse(BaseModel):
    answer: str
    proposals: list[dict]
    traceId: str | None


@app.post("/assistant/chat", response_model=ChatResponse)
def assistant_chat(req: ChatRequest, authorization: str | None = Header(None)):
    """내부 전용. 백엔드가 인증·소유권·사용자별 한도를 확인하고 사용자 토큰과 함께 중계한다(agent-secretary.md 9장)."""
    if not assistant_slots.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="ASSISTANT_BUSY", headers={"Retry-After": "5"})
    try:
        out = agent.run_turn(req.message, [m.model_dump() for m in req.history], req.context.model_dump(),
                             authorization, req.sessionId)
    finally:
        assistant_slots.release()
    return {k: out[k] for k in ("answer", "proposals", "traceId")}


class MerchantItem(BaseModel):
    merchantNorm: str = Field(max_length=200)
    merchantRaw: str = Field(max_length=200)


class ClassifyRequest(BaseModel):
    items: list[MerchantItem] = Field(min_length=1, max_length=200)


@app.post("/classify/merchants")
def classify_merchants(req: ClassifyRequest):
    """내부 전용. 백엔드가 업로드 트랜잭션 전에 규칙으로 못 정한 가맹점을 보낸다.

    숫자만 돌려주고 확정은 백엔드가 임계값으로 정한다. results 는 요청 순서이고, 실패하거나 마감을 넘긴 항목은 null 이다.
    """
    if not settings.classify_api_key or not settings.classify_base_url:
        raise HTTPException(status_code=503, detail="CLASSIFY_UNAVAILABLE")
    return {"model": settings.classify_model, "results": decisions.classify_all([i.model_dump() for i in req.items])}
