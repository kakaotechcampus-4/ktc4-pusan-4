from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    # compose 는 서버 env 에 없는 변수를 빈 값으로 넘긴다. 빈 값은 없는 것으로 보고 기본값을 쓴다.
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore", env_ignore_empty=True)

    database_url: str = "postgresql://ktc4:ktc4-local@localhost:15432/ktc4"
    agent_api_key: str | None = None
    agent_base_url: str | None = None
    # 게이트웨이는 모델마다 엔드포인트가 달라 AGENT_BASE_URL 과 같이 바꾼다.
    # 운영 엔드포인트가 Luna 라 env 가 빠져도 옛 모델(gpt-4o-mini)로 돌아가지 않게 기본값을 맞춘다.
    agent_model: str = "openai/gpt-6-luna"
    # 추론 모델에만 준다. 받지 않는 모델에 보내면 게이트웨이가 400 으로 거절한다.
    # Luna 는 none 이 없으면 추론을 켜고 temperature=0 을 400 으로 거절해 모델과 짝으로 둔다.
    # 빈 값은 없는 것으로 읽혀 이 기본값이 되므로, 추론을 안 받는 모델로 바꾸려면 여기도 고친다.
    agent_reasoning_effort: str | None = "none"
    # 비서(Really). 규칙 후보 파이프라인의 AGENT_* 와 따로 둔다. 모델이 없으면 비서는 안내 문구로만 답한다.
    assistant_model: str | None = None
    assistant_base_url: str | None = None
    assistant_api_key: str | None = None
    assistant_reasoning_effort: str | None = None
    # 가맹점 업종 분류(/v1/decisions). AGENT_*·ASSISTANT_* 와 따로 둔다. 키나 주소가 없으면 503 으로 답한다.
    # 주소는 게이트웨이 base URL 이다. 끝의 /v1 은 있어도 없어도 된다.
    classify_api_key: str | None = None
    classify_base_url: str | None = None
    classify_model: str = "openai/gpt-6-luna"
    # 동시 호출 수, 호출 하나의 타임아웃(초), 요청 전체 마감(초). 마감까지 못 받은 가맹점은 null 로 준다.
    classify_concurrency: int = 8
    classify_call_timeout: float = 4.0
    classify_deadline: float = 8.0
    # 비서 도구가 사용자 토큰으로 부르는 백엔드 공개 API.
    backend_base_url: str = "http://localhost:8080/api/v1"
    embedding_api_key: str | None = None
    embedding_base_url: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_base_url: str = "https://jp.cloud.langfuse.com"
    law_api_oc: str = "test"
    team_discord_webhook: str | None = None

settings = Settings()