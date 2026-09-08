from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from typing import Any

BASE = "https://www.law.go.kr/DRF"
DELAY = 0.3


def as_list(v: Any) -> list:
    """API는 결과가 1건이면 배열 대신 객체를 준다."""
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


class NotApproved(RuntimeError):
    """OC에 해당 API가 신청되어 있지 않다. 재시도해도 소용없다."""


def _get(path: str, params: dict) -> dict:
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        raw = b""
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                raw = r.read()
            if raw.lstrip()[:1] == b"<":
                if "미신청" in raw.decode("utf-8", "replace"):
                    raise NotApproved(params.get("target", "?"))
                raise RuntimeError("JSON 대신 HTML 응답")
            body = json.loads(raw.decode("utf-8"))
            time.sleep(DELAY)
            return body
        except NotApproved:
            raise
        except Exception as exc:
            if attempt == 2:
                snippet = raw[:200].decode("utf-8", "replace")
                raise RuntimeError(f"{exc}\nurl={url}\nbody={snippet!r}") from exc
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def _unwrap(d: dict) -> dict:
    return next(iter(d.values()))


def search(oc: str, target: str, **params: Any) -> dict:
    return _unwrap(_get("lawSearch.do", {"OC": oc, "target": target, "type": "JSON", **params}))


def service(oc: str, target: str, **params: Any) -> dict:
    return _unwrap(_get("lawService.do", {"OC": oc, "target": target, "type": "JSON", **params}))
