"""statute_version 행을 legal_chunk 본문으로 자른다. DB·네트워크를 쓰지 않는다."""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from typing import Any

# text-embedding-3-small 상한은 8191토큰이다. 한국어는 글자당 토큰이 1을 넘으므로
# 글자 수로 보수적으로 끊는다.
MAX_BODY = 5000

# 항내용이 없는 조는 항 본문 첫 줄이 곧 1호다. 그건 접두가 아니다.
_ENUM = re.compile(r"^\d+(?:의\d+)*\.")

_JUDGE = re.compile(r"[0-9]+\.\s*심리\s*및\s*판단")
_CLAIM = re.compile(r"[0-9]+\.\s*청구인\s*주장")

# 개행은 parse.py 가 API 필드를 "\n".join 한 자리라 그대로 필드 경계다.
_CASE_SECTIONS = {"심판례": ("요지", "주문", "이유"), "해석례": ("질의", "회답", "이유")}

# 개정 이력과 한자 병기. 형제 호가 같은 개정일 목록을 달고 있어 임베딩이 그걸로 채워지고
# (시행령-55-1 은 466자 중 316자), `가사(家事)의` 같은 병기는 LIKE '가사의 경비' 를 막는다.
_NOISE = re.compile(
    r"<(?:개정|신설|조항조정|삭제|전문개정)[^<>]*>|<[\d.,\s]+>|\([\u4e00-\u9fff\uf900-\ufaff]+\)"
)


def clean(text: str) -> str:
    return _NOISE.sub("", text)


@dataclass(frozen=True)
class Chunk:
    statute_version_id: int
    statute_id: str
    doc_id: str
    doc_type: str
    hierarchy: str
    section: str | None
    seq: int
    effective_from: date
    effective_to: date | None
    is_superseded: bool
    body: str
    source_hash: str


def _parent(statute_id: str) -> str:
    return statute_id.rsplit("-", 1)[0]


def _emit(row: dict[str, Any], body: str, section: str | None) -> list[Chunk]:
    body = body.strip()
    if not body:
        return []
    # ponytail: 글자 수로 끊어 문장 중간이 잘린다. 검색 품질이 여기서 갈리면
    #           문장 경계 분할 + 겹침으로 바꾼다. 골든셋이 그 판단의 자다.
    parts = [body[i : i + MAX_BODY] for i in range(0, len(body), MAX_BODY)]
    return [
        Chunk(
            statute_version_id=row["id"],
            statute_id=row["statute_id"],
            doc_id=row["doc_id"],
            doc_type=row["doc_type"],
            hierarchy=row["hierarchy"],
            section=section,
            seq=i,
            effective_from=row["effective_from"],
            effective_to=row["effective_to"],
            is_superseded=row["is_superseded"],
            body=part,
            source_hash=row["body_hash"],
        )
        for i, part in enumerate(parts)
    ]


def _lead(statute_id: str, by_id: dict[str, dict]) -> str:
    """조상 행의 첫 줄만 모아 접두로 쓴다.

    "5. 대통령령으로 정하는 가사의 경비" 36자만으로는 어느 법 몇 조인지 알 수 없어
    임베딩이 쓸모없다. 조 제목과 항 도입문을 붙이면 문장이 완성된다.
    단서("다만~")가 항 도입문 꼬리에 있으므로 이 접두가 단서도 같이 들고 온다.
    """
    lines = []
    cur = _parent(statute_id)
    while cur in by_id:
        head = by_id[cur]["body"].split("\n", 1)[0]
        if not _ENUM.match(head):
            lines.append(head)
        cur = _parent(cur)
    return "".join(f"{line}\n" for line in reversed(lines))


def chunk_statutes(rows: Iterable[dict[str, Any]]) -> list[Chunk]:
    """법령·행정규칙. 맨 아래 조항만 색인하고 상위 행은 버린다.

    statute_version 은 같은 조문을 조·항·호 세 단계로 각각 한 행씩 담는다.
    항은 100%가 자기 조 안에, 호는 100%가 자기 항 안에 문자열 그대로 들어 있어
    셋 다 넣으면 검색이 같은 문장을 세 번 돌려준다.
    """
    by_id = {r["statute_id"]: r for r in rows}
    parents = {_parent(s) for s in by_id}
    return [
        c
        for sid, row in by_id.items()
        if sid not in parents
        for c in _emit(row, clean(_lead(sid, by_id) + row["body"]), None)
    ]


def chunk_case(row: dict[str, Any]) -> list[Chunk]:
    """심판례·해석례. 개행으로 세 필드를 되찾고, 심판례 '이유'만 한 번 더 자른다."""
    parts = row["body"].split("\n")
    names = _CASE_SECTIONS.get(row["hierarchy"])
    if names is None or len(parts) != len(names):
        # 필드가 빠진 행. 결론은 첫 필드에 남아 있다.
        return _emit(row, parts[0], "요지")

    out = _emit(row, parts[0], names[0])
    if row["hierarchy"] == "해석례":
        # 마커가 0건이고 기각된 주장 구간도 없다. 회답·이유를 그대로 쓴다.
        out += _emit(row, parts[1], names[1]) + _emit(row, parts[2], names[2])
        return out

    # 심판례 '주문'은 "심판청구를 기각합니다." 한 줄이고 결론은 meta.outcome 에 있다.
    reason = parts[2]
    found = _JUDGE.search(reason)
    if found:
        # 판단 앞은 처분개요와 청구인 주장이 마커 없이 붙어 있어 더 못 가른다.
        # 어느 쪽이든 인용 근거가 아니므로 한 덩어리로 묶고 검색에서 뺀다.
        out += _emit(row, reason[: found.start()], "주장")
        out += _emit(row, reason[found.start() :], "심리판단")
    elif not _CLAIM.search(reason):
        out += _emit(row, reason, "이유")
    # 판단 경계를 못 찾는데 청구인 주장은 있다. 기각된 주장이 근거로 인용되면
    # 정반대 초안이 나가므로 이유를 통째로 버린다(2.6%). 재결요지는 위에서 남겼다.
    return out


def chunk(rows: Iterable[dict[str, Any]]) -> list[Chunk]:
    rows = list(rows)
    statutes = [r for r in rows if r["doc_type"] in ("법령", "행정규칙")]
    out = chunk_statutes(statutes) if statutes else []
    for row in rows:
        if row["doc_type"] == "심판례해석":
            out += chunk_case(row)
        elif row["doc_type"] == "판례":
            out += _emit(row, row["body"], "법원판단")
    return out
