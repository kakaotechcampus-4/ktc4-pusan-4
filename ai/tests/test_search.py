"""조 단위 선택의 순수 부분. SQL 과 임베딩은 여기서 검증하지 않는다."""

from pipeline.search import LEAF_CHARS, Hit, pick


def hit(sid, body="짧은 호", score=0.0):
    return Hit(id=abs(hash(sid)) % 10**6, statute_id=sid, doc_id="X", doc_type="법령",
               hierarchy="법률", section=None, body=body, score=score)


def test_짧은_조는_잎_전부_긴_조는_순위에_든_잎만():
    짧은1, 짧은2 = hit("법-1-1", score=0.02), hit("법-1-2")   # 1-2 는 순위 밖, 형제로만 온다
    긴 = [hit(f"법-2-{i}", "가" * LEAF_CHARS, 0.01 * (5 - i)) for i in range(1, 5)]
    got = pick(["법-1", "법-2"], [짧은1, *긴], [짧은1, 짧은2, *긴])
    assert [h.statute_id for h in got] == ["법-1-1", "법-1-2", "법-2-1", "법-2-2", "법-2-3"]
    assert got[1].score == 0
