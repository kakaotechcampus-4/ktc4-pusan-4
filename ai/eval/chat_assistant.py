"""비서(Really)와 브라우저로 대화해 보는 테스트 페이지. 가짜 백엔드(eval/assistant_fake.py) 데이터로 답한다.

사용: python -m eval.chat_assistant [--port 8765]  →  http://localhost:8765

모델은 .env 의 ASSISTANT_* 를 쓴다. 답과 함께 도구 호출·결과와 제안 카드를 보여 줘서 프롬프트 인젝션을 시험하기 좋다.
Langfuse 에는 chat-assistant 태그로 남는다. 개발용이라 운영 서버(app.main)에는 붙이지 않는다.
"""

import argparse
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from app.config import settings
from app.main import ChatRequest
from assistant.agent import run_turn
from assistant.tools import ROUTES
from eval.assistant_fake import BATCH, YEAR, FakeBackend

PAGE = Path(__file__).with_name("chat_assistant.html")
app = FastAPI(title="Really 테스트")


@app.get("/", response_class=HTMLResponse)
def page():
    ready = settings.assistant_model and settings.assistant_api_key and settings.assistant_base_url
    model = settings.assistant_model if ready else "없음 (ASSISTANT_* 설정이 없어 정해 둔 문구로만 답합니다)"
    screens = "".join(f'<option value="{r}"{" selected" if r == "/questions" else ""}>{name} ({r})</option>'
                      for r, name in ROUTES.items())
    return PAGE.read_text(encoding="utf-8").replace("{{MODEL}}", model).replace("{{SCREENS}}", screens)


@app.post("/chat")
def chat(req: ChatRequest):
    # 가짜 데이터는 업로드가 하나뿐이라 batchId·year 는 여기서 채운다.
    context = {**req.context.model_dump(), "batchId": BATCH, "year": YEAR}
    out = run_turn(req.message, [m.model_dump() for m in req.history], context, None, req.sessionId,
                   backend=FakeBackend(), tags=["chat-assistant"])
    return {**out, "calls": [{"name": n, "arguments": a, "result": r} for n, a, r in out["calls"]]}


def main() -> None:
    ap = argparse.ArgumentParser(description="비서 테스트 페이지")
    ap.add_argument("--port", type=int, default=8765)
    uvicorn.run(app, host="127.0.0.1", port=ap.parse_args().port)


if __name__ == "__main__":
    main()
