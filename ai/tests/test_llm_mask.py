from pipeline.llm import mask


def test_추적에_남기기_전에_개인정보를_가린다():
    data = {"messages": [{"role": "user", "content": "메일 me@example.com, 010-1234-5678, 카드 1234-5678-9012-3456, 900101-1234567"}],
            "amount": 12800, "date": "2026-09-12"}

    assert mask(data=data) == {
        "messages": [{"role": "user", "content": "메일 [이메일], [전화번호], 카드 [카드번호], [주민등록번호]"}],
        "amount": 12800, "date": "2026-09-12"}
