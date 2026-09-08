#!/usr/bin/env python
"""법령·사례 코퍼스 수집.

빈 DB에 돌리면 백필, 매일 돌리면 증분이다. 같은 코드다.

사용:
    python -m pipeline.law_sync
    python -m pipeline.law_sync --target prec --limit 20 --dry-run
    python -m pipeline.law_sync --target law --law 001565
"""

from __future__ import annotations

import argparse
import contextlib
import sys
from collections.abc import Iterator

import psycopg
from psycopg.types.json import Json

from app.config import settings

from .lawapi import NotApproved, as_list, search, service
from .parse import Unit, parse_admrul, parse_decc, parse_expc, parse_law, parse_prec

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

LAWS = [
    "001565",  # 소득세법
    "003956",  # 소득세법 시행령
    "007507",  # 소득세법 시행규칙
    "001571",  # 부가가치세법
    "003666",  # 부가가치세법 시행령
    "007289",  # 부가가치세법 시행규칙
    "001584",  # 조세특례제한법
    "004920",  # 조세특례제한법 시행령
    "008218",  # 조세특례제한법 시행규칙
    "001586",  # 국세기본법
    "002884",  # 국세기본법 시행령
    "006741",  # 국세기본법 시행규칙
]

# 국세청만. 기재부 303건 중 세무 관련은 12건뿐이고 그마저 필요경비와 무관하다
# (공공기관 지정 고시, 외화대출 절차 등). 경비율 고시·업무용승용차 고시·
# 소득세 사무처리규정은 전부 국세청 소관이다.
ADMRUL_ORGS = ["1210000"]

KEYWORDS = [
    "필요경비", "사업소득", "가사경비", "업무무관", "접대비", "기업업무추진비",
    "감가상각", "즉시상각", "증빙", "적격증빙", "경비율", "안분",
]

# 대법원 판례에도 민사·형사가 섞여 온다. 세무 도메인만 남긴다.
PREC_CASE_TYPES = {"세무", "일반행정"}

COMMIT_EVERY = 500

TARGETS = ["law", "admrul", "expc", "decc", "prec"]
DOC_TYPES = {
    "law": "법령", "admrul": "행정규칙",
    "expc": "심판례해석", "decc": "심판례해석", "prec": "판례",
}
# expc와 decc는 doc_type이 같아 일련번호 공간이 섞인다. hierarchy로 가른다.
HIERARCHIES = {"expc": "해석례", "decc": "심판례", "prec": "판례"}

_INSERT = """
INSERT INTO statute_version (
    statute_id, doc_type, doc_id, unit_level, hierarchy, title, doc_no,
    effective_from, issued_at, body, body_hash, source_url, meta)
VALUES (
    %(statute_id)s, %(doc_type)s, %(doc_id)s, %(unit_level)s, %(hierarchy)s,
    %(title)s, %(doc_no)s, %(effective_from)s, %(issued_at)s, %(body)s,
    %(body_hash)s, %(source_url)s, %(meta)s)
"""


def _row(u: Unit) -> dict:
    return {
        "statute_id": u.statute_id,
        "doc_type": u.doc_type,
        "doc_id": u.doc_id,
        "unit_level": u.unit_level,
        "hierarchy": u.hierarchy,
        "title": u.title,
        "doc_no": u.doc_no,
        "effective_from": u.effective_from,
        "issued_at": u.issued_at,
        "body": u.body,
        "body_hash": u.body_hash,
        "source_url": u.source_url,
        "meta": Json(u.meta),
    }


def upsert(conn: psycopg.Connection, u: Unit) -> bool:
    current = conn.execute(
        "SELECT id, body_hash, effective_from FROM statute_version"
        " WHERE statute_id = %s AND effective_to IS NULL",
        (u.statute_id,),
    ).fetchone()

    if current is None:
        conn.execute(_INSERT, _row(u))
        return True

    row_id, body_hash, effective_from = current
    if body_hash == u.body_hash:
        return False

    # 더 오래된 문서가 뒤늦게 왔다. 개정이 아니라 statute_id 충돌이다.
    # 그대로 두면 effective_to < effective_from 이 되어 CHECK 제약에 걸린다.
    if u.effective_from < effective_from:
        return False

    # 시행일이 같은데 본문이 다르면 개정이 아니라 원문 정정이다.
    # 옛 행을 닫으면 effective_to = effective_from 이 되어 CHECK 제약에 걸린다.
    if effective_from == u.effective_from:
        conn.execute(
            "UPDATE statute_version SET body = %s, body_hash = %s, fetched_at = now()"
            " WHERE id = %s",
            (u.body, u.body_hash, row_id),
        )
        return True

    conn.execute(
        "UPDATE statute_version SET effective_to = %s, is_superseded = true WHERE id = %s",
        (u.effective_from, row_id),
    )
    conn.execute(_INSERT, _row(u))
    return True


def _rows(oc: str, target: str, key: str, limit: int | None, **params) -> Iterator[dict]:
    """목록을 페이징한다. display 상한이 100이라 totalCnt 기준으로 돈다."""
    page = sent = 0
    while True:
        page += 1
        result = search(oc, target, display=100, page=page, **params)
        rows = as_list(result.get(key))
        if not rows:
            return
        for row in rows:
            yield row
            sent += 1
            if limit and sent >= limit:
                return
        if page * 100 >= int(result.get("totalCnt") or 0):
            return


def _keyword_rows(
    oc: str, target: str, key: str, id_field: str, limit: int | None,
    known: set[str], **params,
) -> Iterator[dict]:
    """키워드별 본문검색 결과의 합집합. 한 문서가 여러 키워드에 걸린다."""
    seen: set[str] = set()
    for keyword in KEYWORDS:
        for row in _rows(oc, target, key, None, search=2, query=keyword, **params):
            doc_id = str(row.get(id_field) or "")
            if not doc_id or doc_id in seen:
                continue
            seen.add(doc_id)
            # --resume: 이미 적재된 문서는 본문을 받지 않는다
            if doc_id in known:
                continue
            yield row
            if limit and len(seen) >= limit:
                return


def collect(
    oc: str, target: str, limit: int | None, laws: list[str], known: set[str]
) -> Iterator[Unit]:
    if target == "law":
        for law_id in laws:
            yield from parse_law(service(oc, "law", ID=law_id))

    elif target == "admrul":
        for org in ADMRUL_ORGS:
            for row in _rows(oc, "admrul", "admrul", limit, org=org):
                # 공고는 덤핑방지관세 부과 결정 같은 일회성 문서다. 제목이 겹쳐
                # statute_id 가 충돌하고, 필요경비 판정과도 무관하다.
                if row.get("행정규칙종류") == "공고":
                    continue
                yield from parse_admrul(service(oc, "admrul", ID=row["행정규칙일련번호"]))

    elif target == "expc":
        for row in _keyword_rows(oc, "expc", "expc", "법령해석례일련번호", limit, known):
            body = service(oc, "expc", ID=row["법령해석례일련번호"])
            yield from parse_expc(body, row)

    elif target == "decc":
        field = "특별행정심판재결례일련번호"
        for row in _keyword_rows(oc, "ttSpecialDecc", "decc", field, limit, known):
            yield from parse_decc(service(oc, "ttSpecialDecc", ID=row[field]), row)

    elif target == "prec":
        rows = _keyword_rows(oc, "prec", "prec", "판례일련번호", limit, known, datSrcNm="대법원")
        for row in rows:
            # 본문 조회 전에 거른다. 민사·형사가 절반이 넘는다.
            if row.get("사건종류명") not in PREC_CASE_TYPES:
                continue
            yield from parse_prec(service(oc, "prec", ID=row["판례일련번호"]), row)


def main() -> int:
    ap = argparse.ArgumentParser(description="법령·사례 코퍼스 수집")
    ap.add_argument("--target", choices=[*TARGETS, "all"], default="all")
    ap.add_argument("--law", action="append", metavar="법령ID", help="생략하면 LAWS 전체")
    ap.add_argument("--limit", type=int, metavar="N", help="타깃별 최대 문서 수(시험용)")
    ap.add_argument("--dry-run", action="store_true", help="변경 건수만 출력하고 롤백")
    ap.add_argument(
        "--resume",
        action="store_true",
        help="이미 적재된 판례·해석례·심판례는 본문을 받지 않는다. "
        "불변 문서라 안전하지만 파서를 고친 뒤에는 쓰지 말 것",
    )
    args = ap.parse_args()

    targets = TARGETS if args.target == "all" else [args.target]
    total = 0

    with psycopg.connect(settings.database_url) as conn:
        for target in targets:
            sample: list[str] = []
            n_changed = seen = 0
            hashes: dict[str, str] = {}
            clashes: list[str] = []
            known: set[str] = set()
            if args.resume and target in ("expc", "decc", "prec"):
                known = {
                    r[0]
                    for r in conn.execute(
                        "SELECT doc_id FROM statute_version WHERE hierarchy = %s",
                        (HIERARCHIES[target],),
                    ).fetchall()
                }
                print(f"{target:<8} 적재됨 {len(known)}건 건너뜀")

            try:
                for unit in collect(
                    settings.law_api_oc, target, args.limit, args.law or LAWS, known
                ):
                    # 같은 statute_id가 다른 내용으로 두 번 나오면 하나가 조용히 사라진다
                    if hashes.setdefault(unit.statute_id, unit.body_hash) != unit.body_hash:
                        clashes.append(unit.statute_id)
                    if upsert(conn, unit):
                        n_changed += 1
                        if len(sample) < 200:
                            sample.append(unit.statute_id)
                    seen += 1
                    # 수만 건을 한 트랜잭션에 담으면 메모리가 터진다.
                    # upsert가 멱등이라 중간에 죽어도 재실행하면 이어진다.
                    if seen % COMMIT_EVERY == 0:
                        if not args.dry_run:
                            conn.commit()
                        print(f"{target:<8} {seen:6d}행 ...", flush=True)
            except NotApproved:
                print(f"{target:<8} 건너뜀 — OC에 미신청된 API. open.law.go.kr 에서 신청 필요")
                continue
            total += n_changed
            print(f"{target:<8} {len(hashes):6d}행  변경 {n_changed:6d}")
            if clashes:
                print(f"         ⚠️ statute_id 충돌 {len(clashes)}건 — {clashes[:3]}")

            conn.execute(
                "INSERT INTO law_sync_log (target_law, doc_type, changed, changed_statutes)"
                " VALUES (%s, %s, %s, %s)",
                (target, DOC_TYPES[target], bool(n_changed), Json(sample)),
            )

        if args.dry_run:
            conn.rollback()
            print(f"\ndry-run: {total}건 변경 예정. 롤백함")
        else:
            conn.commit()
            print(f"\n총 {total}건 변경")

    return 0


if __name__ == "__main__":
    sys.exit(main())
