"""백엔드 공개 API 조회. 사용자 토큰을 그대로 넘겨 그 사용자 권한으로만 읽는다."""

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import settings


class BackendClient:
    def __init__(self, auth: str | None, base_url: str | None = None):
        self.auth = auth
        self.base_url = (base_url or settings.backend_base_url).rstrip("/")

    def get(self, path: str, **params) -> dict:
        """HTTP 오류는 urllib 예외로 올린다. 도구가 받아서 결과로 바꾼다."""
        query = urlencode({k: v for k, v in params.items() if v is not None})
        req = Request(self.base_url + path + (f"?{query}" if query else ""))
        if self.auth:
            req.add_header("Authorization", self.auth)
        with urlopen(req, timeout=5) as res:
            return json.load(res)
