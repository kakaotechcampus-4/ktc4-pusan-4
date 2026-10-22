"""집계 블록. 모델 없이 돈다."""

from pipeline.query import context


def test_업종_정보는_대상_카테고리_자기_칸을_뺀다():
    block = context("의료", "940909", "RULE_NOT_FOUND", meta={})
    assert "업종: 인적용역" in block and "  미용: 비통상" in block
    # 카드가 자기 칸에서 만들어진다. 보여주면 하네스가 정답을 알려주고 채점한다
    assert "  의료:" not in block
    # 프로파일이 없는 업종은 집계 네 줄뿐이다
    assert len(context("의료", "000000", "RULE_NOT_FOUND", meta={}).splitlines()) == 4
