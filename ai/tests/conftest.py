import os

# 루트 .env 에 Langfuse 키가 있어도 테스트는 추적을 보내지 않는다. pipeline.llm 이 Langfuse 를 만들기 전에 정해야 한다.
os.environ["LANGFUSE_TRACING_ENABLED"] = "false"
