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


def _get(path: str, params: dict) -> dict:
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                body = json.loads(r.read().decode("utf-8"))
            time.sleep(DELAY)
            return body
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def _unwrap(d: dict) -> dict:
    return next(iter(d.values()))


def search(oc: str, target: str, **params: Any) -> dict:
    return _unwrap(_get("lawSearch.do", {"OC": oc, "target": target, "type": "JSON", **params}))


def service(oc: str, target: str, **params: Any) -> dict:
    return _unwrap(_get("lawService.do", {"OC": oc, "target": target, "type": "JSON", **params}))
