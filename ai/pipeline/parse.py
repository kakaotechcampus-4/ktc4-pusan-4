from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

from .lawapi import as_list

_HIERARCHY = {"법률": "법률", "대통령령": "시행령"}
_DELETED = re.compile(r"^(\S{1,8}\s*)?삭제\s*(<|$)")
# 호번호 필드는 가지번호를 빠뜨린다('2의2'가 '2.'로 온다). 내용 앞의 번호가 정확하다.
_HO_NO = re.compile(r"^(\d+(?:의\d+)*)\.")
# 다른 조로 이동한 조는 '제8조'만 남는다
_MOVED = re.compile(r"^제\d+조(의\d+)?\s*$")


@dataclass(frozen=True)
class Unit:
    statute_id: str
    doc_type: str
    doc_id: str
    unit_level: str
    hierarchy: str
    title: str
    doc_no: str | None
    effective_from: date
    issued_at: date | None
    body: str
    source_url: str
    meta: dict

    @property
    def body_hash(self) -> str:
        return hashlib.sha256(self.body.encode("utf-8")).hexdigest()


def _flat(v: Any) -> list[str]:
    """내용 필드는 문자열·리스트·중첩리스트 중 무엇으로든 온다."""
    if v is None:
        return []
    if isinstance(v, str):
        return [v.strip()] if v.strip() else []
    return [s for x in v for s in _flat(x)]


def _text(v: Any) -> str:
    return "\n".join(_flat(v))


def _date(s: Any) -> date | None:
    s = str(s or "")
    return date(int(s[:4]), int(s[4:6]), int(s[6:8])) if len(s) == 8 else None


def _deleted(text: str) -> bool:
    return bool(_DELETED.match(text))


def _hang_no(mark: str | None) -> int:
    if not mark:
        return 1
    c = mark[0]
    if "①" <= c <= "⑳":
        return ord(c) - 0x2460 + 1
    return int(re.sub(r"\D", "", mark) or 1)


def parse_law(payload: dict) -> list[Unit]:
    info = payload["기본정보"]
    doc_id = str(info["법령ID"])
    title = info["법령명_한글"]
    name = title.replace(" ", "")
    hierarchy = _HIERARCHY.get(info["법종구분"]["content"], "시행규칙")
    issued_at = _date(info["공포일자"])
    doc_no = str(info["공포번호"])
    fallback_ef = _date(info["시행일자"])

    units: list[Unit] = []
    for jo in as_list(payload["조문"]["조문단위"]):
        if jo.get("조문여부") != "조문":
            continue

        branch = jo.get("조문가지번호")
        jo_key = f"{jo['조문번호']}의{branch}" if branch else str(jo["조문번호"])
        common = {
            "doc_type": "법령",
            "doc_id": doc_id,
            "hierarchy": hierarchy,
            "title": title,
            "doc_no": doc_no,
            "effective_from": _date(jo.get("조문시행일자")) or fallback_ef,
            "issued_at": issued_at,
            "source_url": f"https://www.law.go.kr/법령/{name}/제{jo_key}조",
            "meta": {"조문제목": jo.get("조문제목"), "조문번호": jo_key},
        }

        jo_body = [_text(jo.get("조문내용"))]
        nested: list[Unit] = []

        for hang in as_list(jo.get("항")):
            htext = _text(hang.get("항내용"))
            hos = as_list(hang.get("호"))
            if _deleted(htext) or (not htext and not hos):
                continue
            hno = _hang_no(hang.get("항번호"))
            hang_body = _flat(htext)

            for ho in hos:
                otext = _text(ho.get("호내용"))
                if not otext or _deleted(otext):
                    continue
                mok = [_text(m.get("목내용")) for m in as_list(ho.get("목"))]
                ho_body = "\n".join([otext, *filter(None, mok)])
                hang_body.append(ho_body)
                m = _HO_NO.match(otext)
                ono = m.group(1) if m else (ho.get("호번호") or "").rstrip(".")
                nested.append(
                    Unit(statute_id=f"{name}-{jo_key}-{hno}-{ono}", unit_level="호", body=ho_body, **common)
                )

            body = "\n".join(hang_body)
            if not body:
                continue
            jo_body.append(body)
            nested.append(Unit(statute_id=f"{name}-{jo_key}-{hno}", unit_level="항", body=body, **common))

        body = "\n".join(filter(None, jo_body))
        if not nested and (not body or _deleted(body) or _MOVED.match(body)):
            continue
        units.append(Unit(statute_id=f"{name}-{jo_key}", unit_level="조", body=body, **common))
        units.extend(nested)

    return units
