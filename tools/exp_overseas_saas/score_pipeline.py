"""분류 흐름 전체로 채점: rules/keyword_rules.yaml 먼저, 못 잡으면 사전 매칭(match.py).

비교: A 키워드룰만(develop 현재) / B 키워드룰 + 사전 / C 사전만.
자동 확정 = 사용자 분류 없이 카테고리가 정해진 건(미분류·PG_미상은 사용자에게 가서 제외).
"""
import json, re, yaml
from pathlib import Path
import match as M

HERE = Path(__file__).resolve().parent
RULES = [r for r in yaml.safe_load(open(HERE.parents[1] / "rules" / "keyword_rules.yaml", encoding="utf-8"))["rules"]]
for i, r in enumerate(RULES):
    r["i"], r["rx"] = i, re.compile(r["match"], re.I)
ASK = {"미분류", "PG_미상"}  # 사용자에게 가는 것


def keyword(desc):  # tools/keyword_rules.py 와 같은 승자 기준
    hits = [r for r in RULES if r["rx"].search(desc)]
    if not hits:
        return None
    w = sorted(hits, key=lambda r: (-r["priority"], -len(r["match"]), r["i"]))[0]
    return None if w.get("needs_review") else w["category"]


def run(use_keyword, use_dict):
    saved = dict(M.DICT)
    if not use_dict:
        M.DICT.clear()
    res = []
    for e in json.load(open(HERE / "eval_set.json", encoding="utf-8")):
        c = keyword(e["descriptor"]) if use_keyword else None
        how = "keyword"
        if c is None:
            c, how, _ = M.classify(e["descriptor"])
        res.append((e, c, how))
    M.DICT.update(saved)
    auto = [x for x in res if x[1] not in ASK]
    tool = [x for x in res if x[0]["label"] == "해외SaaS"]
    return res, auto, tool


if __name__ == "__main__":
    for name, k, d in (("A 키워드룰만(develop 현재)", True, False),
                       ("B 키워드룰 + 사전", True, True),
                       ("C 사전만", False, True)):
        res, auto, tool = run(k, d)
        ok = sum(c == e["label"] for e, c, _ in auto)
        print(f"{name}: 자동 확정 {len(auto)}/{len(res)}, 정확도 {ok}/{len(auto)}, "
              f"도구 재현율 {sum(c == '해외SaaS' for _, c, _ in tool)}/{len(tool)}")
        for e, c, how in auto:
            if c != e["label"]:
                print(f"    오답 [{e['label']}→{c}] {e['descriptor']} ({how})")
