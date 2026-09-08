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
# 행정규칙 조문내용은 평문 리스트라 접두사로만 조를 가른다
_ADM_JO = re.compile(r"^제(\d+)조(?:의(\d+))?")
# '제47조<삭제, 2023.1.30.>'. '제5조(삭제된 문서의 처리)'는 걸리면 안 된다
_ADM_EMPTY = re.compile(r"^삭제\s*[<,.)\]]|^삭제\s*$")
# 판결문의 주문 마커. 공백이 들어간다 ('【주    문】')
_JUDGMENT = re.compile(r"【\s*주\s*문\s*】")
# 심판례 사건명 말미의 (기각)/(인용)
_OUTCOME = re.compile(r"[(\[]([^)\]]{1,10})[)\]]\s*$")
_TAG = re.compile(r"</?(?:img|br|p|div|span|table|tr|td|th|b|i|u|font)\b[^>]*>", re.IGNORECASE)


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
    s = re.sub(r"<br\s*/?>", "\n", "\n".join(_flat(v)))
    # 태그명을 열거한다. <[^>]*> 로 지우면 '<개정 2009.12.31>' 같은 법령 표기가 날아간다.
    return _TAG.sub("", s).strip()


def _date(s: Any) -> date | None:
    """본문은 20141218, 목록은 2014.12.18 로 온다."""
    d = re.sub(r"\D", "", str(s or ""))
    return date(int(d[:4]), int(d[4:6]), int(d[6:8])) if len(d) == 8 else None


def _deleted(text: str) -> bool:
    return bool(_DELETED.match(text))


def _hang_no(mark: str | None) -> int:
    if not mark:
        return 1
    c = mark[0]
    if "①" <= c <= "⑳":
        return ord(c) - 0x2460 + 1
    return int(re.sub(r"\D", "", mark) or 1)


def parse_admrul(payload: dict) -> list[Unit]:
    info = payload["행정규칙기본정보"]
    title = info["행정규칙명"]
    doc_id = str(info["행정규칙ID"])
    # 행정규칙명은 유일하지 않다. '업무용승용차 운행기록 방법에 관한 고시'는
    # 소득세법 근거와 법인세법 근거 둘이 같은 이름으로 동시에 현행이다.
    # 발령번호는 개정마다 바뀌어 버전 체인이 끊기므로 행정규칙ID를 쓴다.
    name = f"{title.replace(' ', '')}#{doc_id}"
    effective_from = _date(info.get("시행일자")) or _date(info.get("발령일자"))
    if not effective_from:
        return []

    common = {
        "doc_type": "행정규칙",
        "doc_id": doc_id,
        "hierarchy": info.get("행정규칙종류") or "고시",
        "title": title,
        "doc_no": str(info.get("발령번호") or ""),
        "effective_from": effective_from,
        "issued_at": _date(info.get("발령일자")),
        "source_url": f"https://www.law.go.kr/행정규칙/{title.replace(' ', '')}",
        "meta": {"소관부처명": info.get("소관부처명"), "현행여부": info.get("현행여부")},
    }

    units = []
    for text in _flat(payload.get("조문내용")):
        m = _ADM_JO.match(text)
        if not m:
            continue
        body = _text(text)
        rest = body[m.end() :].lstrip(" (<")
        if not rest or _ADM_EMPTY.match(rest):
            continue
        jo = f"{m.group(1)}의{m.group(2)}" if m.group(2) else m.group(1)
        units.append(Unit(statute_id=f"{name}-{jo}", unit_level="조", body=body, **common))

    # 조문형식이 아닌 고시는 통째로 한 행
    if not units:
        body = _text(payload.get("조문내용"))
        if body:
            units.append(Unit(statute_id=f"{name}-전문", unit_level="문서", body=body, **common))
    return units


def parse_prec(payload: dict, row: dict) -> list[Unit]:
    doc_id = str(payload.get("판례정보일련번호") or row.get("판례일련번호") or "")
    when = _date(payload.get("선고일자")) or _date(row.get("선고일자"))
    if not doc_id or not when:
        return []

    content = _text(payload.get("판례내용"))
    m = _JUDGMENT.search(content)
    # 주문 이전은 당사자·원심판결 정보다. 마커가 없으면 본문을 통째로 버린다 —
    # 원고 주장이 섞이느니 판시사항·판결요지만 담는 쪽이 안전하다.
    parts = [
        _text(payload.get("판시사항")),
        _text(payload.get("판결요지")),
        content[m.start() :] if m else "",
    ]
    body = "\n".join(filter(None, parts))
    if not body:
        return []

    return [
        Unit(
            statute_id=f"판례-{doc_id}",
            doc_type="판례",
            doc_id=doc_id,
            unit_level="문서",
            hierarchy="판례",
            title=payload.get("사건명") or row.get("사건명") or "",
            doc_no=payload.get("사건번호") or row.get("사건번호"),
            effective_from=when,
            issued_at=when,
            body=body,
            source_url=f"https://www.law.go.kr/LSW/precInfoP.do?precSeq={doc_id}",
            meta={
                "법원명": payload.get("법원명"),
                "사건종류명": payload.get("사건종류명"),
                "데이터출처명": row.get("데이터출처명"),
                "참조조문": payload.get("참조조문"),
                "참조판례": payload.get("참조판례"),
                "outcome": payload.get("판결유형"),
                "본문절단": bool(m),
            },
        )
    ]


def parse_expc(payload: dict, row: dict) -> list[Unit]:
    doc_id = str(payload.get("법령해석례일련번호") or row.get("법령해석례일련번호") or "")
    when = _date(payload.get("해석일자")) or _date(row.get("회신일자"))
    body = "\n".join(
        filter(None, (_text(payload.get(k)) for k in ("질의요지", "회답", "이유")))
    )
    if not doc_id or not when or not body:
        return []

    return [
        Unit(
            statute_id=f"해석례-{doc_id}",
            doc_type="심판례해석",
            doc_id=doc_id,
            unit_level="문서",
            hierarchy="해석례",
            title=payload.get("안건명") or row.get("안건명") or "",
            doc_no=payload.get("안건번호") or row.get("안건번호"),
            effective_from=when,
            issued_at=when,
            body=body,
            source_url=f"https://www.law.go.kr/DRF/lawService.do?target=expc&ID={doc_id}&type=HTML",
            meta={
                "해석기관명": payload.get("해석기관명"),
                "질의기관명": payload.get("질의기관명") or row.get("질의기관명"),
            },
        )
    ]


def parse_decc(payload: dict, row: dict) -> list[Unit]:
    doc_id = str(
        payload.get("특별행정심판재결례일련번호") or row.get("특별행정심판재결례일련번호") or ""
    )
    when = _date(payload.get("의결일자")) or _date(row.get("의결일자"))
    body = "\n".join(
        filter(None, (_text(payload.get(k)) for k in ("재결요지", "주문", "이유")))
    )
    if not doc_id or not when or not body:
        return []

    title = payload.get("사건명") or row.get("사건명") or ""
    outcome = _OUTCOME.search(title)
    return [
        Unit(
            statute_id=f"심판례-{doc_id}",
            doc_type="심판례해석",
            doc_id=doc_id,
            unit_level="문서",
            hierarchy="심판례",
            title=title,
            # 본문 응답의 청구번호는 빈 문자열이다. 목록 행에서 가져온다.
            doc_no=row.get("청구번호") or payload.get("청구번호"),
            effective_from=when,
            issued_at=when,
            body=body,
            source_url=f"https://www.law.go.kr/DRF/lawService.do?target=ttSpecialDecc&ID={doc_id}&type=HTML",
            meta={
                "세목": payload.get("세목"),
                "관련법령": payload.get("관련법령"),
                "재결청": payload.get("재결청") or row.get("재결청"),
                "따른결정": payload.get("따른결정"),
                "참조결정": payload.get("참조결정"),
                "outcome": outcome.group(1) if outcome else None,
            },
        )
    ]


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
