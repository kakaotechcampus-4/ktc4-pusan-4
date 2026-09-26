"""하이브리드 검색 — 벡터와 pg_bigm 을 RRF 로 융합한다.

벡터만 쓰면 "3만원 초과"와 "5만원 초과"의 임베딩이 거의 같아 세법에서 판정을
가르는 숫자를 놓친다. 키워드만 쓰면 구어체 질문과 법률 문어체가 글자가 안 겹쳐
못 찾는다. 둘을 순위로 합치면 가중치를 안 정해도 된다.

키워드 쪽은 `=%` 가 아니라 LIKE 다. `=%` 는 길이가 비슷한 두 문자열의 유사도
검색용이라, 짧은 질의와 긴 조문 사이에서는 기본 임계값(0.3)을 못 넘어 통째로
죽는다(실측: '업무와 관련이 없다고 인정되는 금액' vs 소득세법-33-1-13 = 0.129).
pg_bigm 의 gin_bigm_ops 인덱스는 원래 LIKE 를 가속하라고 있는 것이다.
임계값을 낮추려면 shared_preload_libraries 가 필요한데 지금 비어 있기도 하다.

키워드 쪽 순위는 bigm_similarity 가 아니라 '몇 개나 걸렸나'로 매긴다. 짧은 용어와
긴 본문 사이의 유사도는 본문이 짧을수록 커져서, 그걸로 정렬하면 관련성이 아니라
짧은 청크 순이 된다(실측: 그렇게 두면 recall@8 이 4/10 에서 2/10 으로 내려간다).
"""

from __future__ import annotations

from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import date

import psycopg
from psycopg.rows import dict_row

from pipeline.embed import embed

# 위계는 여기서 지키지 않는다. 네 개를 다 뒤지고, 하위 근거만으로 확정 결론이
# 서 있는지는 초안 검증이 본다(CONTEXT.md 9.5). 조기 종료를 두면 그 판정 자체가
# 모델의 "이 정도면 됐다"가 되고, 법령에서 끊으면 심판례의 반례를 영영 못 본다.
TIERS = ["법령", "행정규칙", "심판례해석", "판례"]

# 기각된 청구인 주장이 근거로 인용되면 정반대 결론이 나간다.
SKIP_SECTIONS = ["주장"]

# 검색 대상이 아니라 전제다. G1 은 33조1항 열거 호, G2 는 27조1항 통상성이라 카드 인용의
# 대부분이 여기서 나오는데, 주제 질의로는 수백 위로 밀린다(docs/rag-eval.md).
FRAME = ("소득세법-27", "소득세법-33")

TOP_K = 8
CANDIDATES = 200
RRF_K = 60

# 법령은 형제 호가 같은 머리말을 달아 한 조가 상위를 다 먹는다. 조 단위로 k 개를 고르고
# 그 조의 잎을 보여준다. 잎 합계(머리말 포함)가 이보다 길면 순위에 든 잎만 LONG_LEAVES 개.
LEAF_CHARS = 4500
LONG_LEAVES = 3

_FILTER = """
    doc_type = %(tier)s
    AND is_superseded = false
    AND (effective_to IS NULL OR effective_to > %(on)s)
    AND (section IS NULL OR section <> ALL(%(skip)s))
"""

# 벡터 r위와 키워드 r위는 점수가 같고 두 목록이 거의 안 겹쳐 top-k 경계가 동점으로 갈린다.
# 재색인해도 안 바뀌는 (statute_id, section, seq) 로 깬다. id 는 재색인마다 바뀐다.
_SQL = f"""
WITH vec AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY d, statute_id, section, seq) AS rnk FROM (
        SELECT id, statute_id, section, seq, embedding <=> %(q_vec)s::vector AS d
          FROM legal_chunk WHERE {_FILTER}
         ORDER BY d, statute_id, section, seq LIMIT %(cand)s) t
), kw AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY n DESC, s DESC, statute_id, section, seq) AS rnk FROM (
        SELECT c.id, c.statute_id, c.section, c.seq,
               count(DISTINCT k) AS n, max(bigm_similarity(c.body, k)) AS s
          FROM legal_chunk c, unnest(%(kws)s::text[]) AS k
         WHERE {_FILTER} AND c.body LIKE '%%' || k || '%%'
         GROUP BY c.id ORDER BY n DESC, s DESC, c.statute_id, c.section, c.seq LIMIT %(cand)s) t
)
SELECT c.id, c.statute_id, c.doc_id, c.doc_type, c.hierarchy, c.section, c.body,
       (COALESCE(1.0 / (%(rrf)s + vec.rnk), 0)
      + COALESCE(1.0 / (%(rrf)s + kw.rnk), 0))::float8 AS score
  FROM legal_chunk c
  LEFT JOIN vec ON c.id = vec.id
  LEFT JOIN kw  ON c.id = kw.id
 WHERE vec.id IS NOT NULL OR kw.id IS NOT NULL
 ORDER BY score DESC, c.statute_id, c.section, c.seq LIMIT %(k)s
"""

_LEAVES = f"""
SELECT id, statute_id, doc_id, doc_type, hierarchy, section, body, 0::float8 AS score
  FROM legal_chunk
 WHERE {_FILTER} AND (statute_id = ANY(%(arts)s) OR statute_id LIKE ANY(%(pre)s))
 ORDER BY id
"""


@dataclass(frozen=True)
class Hit:
    id: int
    statute_id: str
    doc_id: str
    doc_type: str
    hierarchy: str
    section: str | None
    body: str
    score: float


def search(
    conn: psycopg.Connection,
    query: str,
    tier: str,
    on: date,
    k: int = TOP_K,
    q_vec: list[float] | None = None,
    keywords: Sequence[str] = (),
) -> list[Hit]:
    """한 질의로 한 위계만 뒤진다. q_vec 를 넘기면 임베딩을 다시 부르지 않는다.

    두 쪽이 원하는 질의 길이가 반대다. 벡터는 문맥이 붙을수록 잘 찾고, LIKE 는
    글자가 그대로 본문에 있어야 해서 길어지면 한 건도 안 걸린다. 그래서 키워드를
    따로 받는다. 비워두면 벡터 단독으로 돈다 — 빈 배열은 LIKE 가 0행이라 그대로다.
    """
    vector = q_vec if q_vec is not None else embed([query])[0]
    rows = conn.execute(
        _SQL,
        {
            "q_vec": str(vector),
            "kws": list(keywords),
            "tier": tier,
            "on": on,
            "skip": SKIP_SECTIONS,
            # 후보가 k 보다 적으면 상위 k 를 채울 수 없다. 재현율 곡선을 재려고
            # k 를 올릴 때 후보도 같이 올라가야 한다.
            "cand": max(CANDIDATES, k),
            "rrf": RRF_K,
            "k": k,
        },
    ).fetchall()
    return [Hit(**r) for r in rows]


def _article(statute_id: str) -> str:
    return "-".join(statute_id.split("-")[:2])


def pick(arts: Sequence[str], ranked: list[Hit], leaves: list[Hit]) -> list[Hit]:
    """조마다 잎을 전부(조문 순서) 보여준다. 조가 길면 순위에 든 잎 상위 LONG_LEAVES 개만.

    순위에 든 잎은 점수를 단 채로 돌려준다. 점수 0 은 형제로 딸려 온 잎이다.
    """
    scored = {h.id: h for h in ranked}
    out = []
    for a in arts:
        mine = [scored.get(h.id, h) for h in leaves if _article(h.statute_id) == a]
        if sum(len(h.body) for h in mine) > LEAF_CHARS:
            mine = [h for h in ranked if _article(h.statute_id) == a][:LONG_LEAVES]
        out += mine
    return out


def search_tier(
    conn: psycopg.Connection,
    queries: Sequence[str],
    keywords: Sequence[str],
    tier: str,
    on: date,
    k: int = TOP_K,
    vecs: Sequence[list[float]] | None = None,
    skip: Collection[str] = (),
) -> list[Hit]:
    """질의 여러 개를 각각 돌려 합친다. 같은 청크가 겹치면 높은 점수를 남긴다.

    질의별 RRF 점수는 같은 식에서 나와 서로 비교 가능하다. 합산하지 않는 이유는
    질의를 많이 쓴 청크가 유리해져서 — 한 갈래만 맞는 조문이 밀린다.

    법령은 조 단위로 k 개를 고른다. skip 은 뽑지 않을 조다 — 기본 조문은 retrieve 가
    따로 붙이므로 검색 칸을 먹으면 안 된다. 심판례는 두 토막이 문서 전체라 묶지 않는다.
    """
    vecs = embed(list(queries)) if vecs is None else vecs
    best: dict[int, Hit] = {}
    for q, v in zip(queries, vecs, strict=True):
        for h in search(conn, q, tier, on, CANDIDATES, q_vec=v, keywords=keywords):
            if h.id not in best or h.score > best[h.id].score:
                best[h.id] = h
    ranked = [h for h in sorted(best.values(), key=lambda h: -h.score) if _article(h.statute_id) not in skip]
    if tier != "법령":
        return ranked[:k]
    arts = list(dict.fromkeys(_article(h.statute_id) for h in ranked))[:k]
    return pick(arts, ranked, _leaves(conn, arts, tier, on))


def search_tiers(
    conn: psycopg.Connection,
    queries: Sequence[str],
    keywords: Sequence[str],
    on: date,
    k: int = TOP_K,
    tiers: Sequence[str] = TIERS,
    skip: Collection[str] = (),
) -> dict[str, list[Hit]]:
    """네 위계를 한 번에 본다. 임베딩은 질의당 한 번뿐이다."""
    vecs = embed(list(queries))
    return {t: search_tier(conn, queries, keywords, t, on, k, vecs, skip) for t in tiers}


def _leaves(conn: psycopg.Connection, arts: Sequence[str], tier: str, on: date) -> list[Hit]:
    """조 ID 들의 잎 청크. 배열 인자는 list 로 넘긴다 — 튜플은 record 로 간다."""
    rows = conn.execute(
        _LEAVES,
        {"arts": list(arts), "pre": [f"{a}-%" for a in arts], "tier": tier, "on": on, "skip": SKIP_SECTIONS},
    ).fetchall()
    return [Hit(**r) for r in rows]


def retrieve(
    conn: psycopg.Connection,
    queries: Sequence[str],
    keywords: Sequence[str],
    on: date,
    drop: Collection[str] = (),
) -> dict[str, list[Hit]]:
    """검색 결과 앞에 기본 조문(FRAME)을 '기본' 위계로 붙인다. 검색은 FRAME 조를 건너뛴다.

    drop 은 이 사업자에게 적용되지 않는 statute_id 다(query.NOT_APPLICABLE).
    """
    base = [h for h in _leaves(conn, FRAME, "법령", on) if h.statute_id not in drop]
    found = search_tiers(conn, queries, keywords, on, skip=FRAME)
    return {"기본": base} | {t: [h for h in hs if h.statute_id not in drop] for t, hs in found.items()}


def connect() -> psycopg.Connection:
    from app.config import settings

    return psycopg.connect(settings.database_url, row_factory=dict_row)
