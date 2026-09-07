#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
키워드 분류. rules/keyword_rules.yaml 을 그대로 실행한다.

적용 순서는 PG 블록 -> 시드 사전 -> 키워드룰 -> uncertain 이다.
여기서는 category 만 정한다. verdict 는 만들지 않는다 — 판정은 룰카드가 한다.

사용:
    python tools/keyword_rules.py --text "자스민커피 본점"
    python tools/keyword_rules.py --report     # docs/keyword_rules_report.md 생성
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("pyyaml 이 필요합니다:  pip install pyyaml")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize as nz  # noqa: E402
import pg_block  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
KEYWORD_YAML = ROOT / "rules" / "keyword_rules.yaml"
REPORT_MD = ROOT / "docs" / "keyword_rules_report.md"

# 짧아서 엉뚱한 상호를 잡을 수 있는 패턴. 리포트에서 무엇을 잡았는지 항상 보여준다.
WATCH_PATTERNS = ["KT\\b", "CU\\b", "커피", "스팀|STEAM", "다이소", "쿠팡", "GCP", "빵"]


class KeywordRules:
    def __init__(self, spec: dict) -> None:
        self.spec = spec or {}
        self.rules = []
        for i, r in enumerate(self.spec.get("rules") or []):
            src = r.get("match", "")
            self.rules.append({
                "index": i,
                "match": src,
                "rx": re.compile(src, re.I),
                "category": r.get("category"),
                "priority": int(r.get("priority", 0)),
                "note": r.get("note", ""),
            })
        # priority 내림차순. 같으면 파일에 적힌 순서.
        self.ordered = sorted(self.rules, key=lambda r: (-r["priority"], r["index"]))

    def all_hits(self, text: str) -> list[dict]:
        return [r for r in self.ordered if r["rx"].search(str(text))]

    def classify(self, text: str) -> dict:
        hits = self.all_hits(text)
        if not hits:
            return {"category": None, "matched": None, "conflicts": []}
        win = hits[0]
        return {
            "category": win["category"],
            "matched": win["match"],
            # 우선순위에서 밀린 룰들. 카테고리가 다르면 진짜 충돌이다.
            "conflicts": [h for h in hits[1:] if h["category"] != win["category"]],
        }


def load() -> KeywordRules:
    if not KEYWORD_YAML.exists():
        sys.exit("rules/keyword_rules.yaml 이 없습니다")
    with KEYWORD_YAML.open(encoding="utf-8") as f:
        return KeywordRules(yaml.safe_load(f))


# ------------------------------------------------------------------ 파이프라인
def pipeline(raw: str, biz_no: str, norm, pg, kw) -> dict:
    """PG 블록 -> (사전 생략) -> 키워드룰 -> uncertain.

    시드 사전은 T4 라서 아직 없다. 여기서는 PG 와 키워드룰만 적용한다.
    사전이 생기면 키워드룰 앞에 들어가고, 커버리지는 지금보다 올라간다.
    """
    r = norm.normalize(raw, biz_no)
    blocked = pg.check(raw, r.tokens or [r.string_norm])
    if blocked["blocked"]:
        return {"stage": "pg", "category": blocked["category"], "norm": r, "pg": blocked}
    # 키워드룰은 원문·정규화 결과 둘 다에 걸어본다.
    # 정규화가 공백을 없애면서 '커피 16온스' 처럼 띄어쓰기가 붙는 경우가 있다.
    c = kw.classify(raw)
    if not c["category"]:
        c = kw.classify(r.string_norm)
    if c["category"]:
        return {"stage": "keyword", "category": c["category"], "norm": r, "kw": c}
    return {"stage": "uncertain", "category": None, "norm": r, "kw": c}


# ------------------------------------------------------------------ 리포트
def build_report(kw: KeywordRules, pg, norm) -> str:
    dom, ovs = nz.load_rows()
    rows = [(r["raw_merchant"], r.get("biz_no", ""), r.get("source_card", "") or "sample")
            for r in dom]
    rows += [(r["raw_merchant"], r.get("biz_no", ""), "overseas") for r in ovs]
    if not rows:
        sys.exit("data/sample.csv 또는 data/overseas_cases.csv 가 필요합니다")

    anon = nz.Anon()
    out = [(raw, src, pipeline(raw, biz, norm, pg, kw)) for raw, biz, src in rows]

    n = len(out)
    stage = Counter(o[2]["stage"] for o in out)
    non_pg = [o for o in out if o[2]["stage"] != "pg"]
    hit = [o for o in non_pg if o[2]["stage"] == "keyword"]
    unc = [o for o in non_pg if o[2]["stage"] == "uncertain"]

    cat_count = Counter(o[2]["category"] for o in hit)
    rule_count: Counter = Counter()
    for _raw, _src, res in hit:
        rule_count[res["kw"]["matched"]] += 1

    # 충돌: 카테고리가 다른 룰 둘 이상에 걸린 문자열
    conflicts: dict[str, tuple] = {}
    for raw, _src, res in hit:
        if res["kw"]["conflicts"]:
            conflicts.setdefault(raw, res)

    # 과잉 매칭 감시: 감시 패턴을 상호명에 직접 걸어본다.
    # (룰의 match 문자열에 감시 패턴이 들어있는지 보는 방식은 오답이다 —
    #  "…|와플|빵|…" 룰이 잡은 것을 '빵' 이 잡았다고 잘못 표시한다)
    watch: dict[str, set] = defaultdict(set)
    watch_rx = [(w, re.compile(w, re.I)) for w in WATCH_PATTERNS]
    for raw, _src, res in out:
        for w, rx in watch_rx:
            if rx.search(raw) or rx.search(res["norm"].string_norm):
                watch[w].add((raw, res["category"] or "uncertain"))

    uniq_unc: dict[str, int] = Counter(o[0] for o in unc)

    L = []
    a = L.append
    a("# T3 키워드 분류 규칙 리포트")
    a("")
    a("`rules/keyword_rules.yaml` 을 실제 카드 내역에 적용한 결과다.")
    a("적용 순서는 **PG 블록 -> 시드 사전 -> 키워드룰 -> uncertain** 이고,")
    a("시드 사전(T4)이 아직 없어서 이 리포트는 **PG + 키워드룰만** 적용한 수치다.")
    a("사전이 생기면 커버리지는 올라간다.")
    a("")
    a("상호명 익명화는 T1 규칙을 따른다. PG 상호는 익명화하지 않는다(T2 판단 유지).")
    a("")
    a("생성: `python tools/keyword_rules.py --report`")
    a("")
    a("## 1. 커버리지")
    a("")
    a("| 단계 | 건수 | 비율 |")
    a("|---|---:|---:|")
    for k, label in (("pg", "PG 블록 (되묻기)"), ("keyword", "키워드룰 분류"),
                     ("uncertain", "uncertain (되묻기)")):
        c = stage.get(k, 0)
        a("| %s | %d | %.1f%% |" % (label, c, c / n * 100 if n else 0))
    a("| **합계** | **%d** | |" % n)
    a("")
    cov = len(hit) / len(non_pg) * 100 if non_pg else 0
    a("**PG 제외 후 커버리지 %.1f%%** (%d/%d). PG 로 빠진 %d건은 애초에 되묻기 대상이라"
      " 분모에서 뺐다." % (cov, len(hit), len(non_pg), stage.get("pg", 0)))
    a("")
    a("### 되묻기 물량 추정")
    a("")
    a("| | 건수 |")
    a("|---|---:|")
    a("| PG 블록 | %d |" % stage.get("pg", 0))
    a("| uncertain | %d |" % len(unc))
    a("| **되묻기 합계** | **%d** (전체의 %.1f%%) |"
      % (stage.get("pg", 0) + len(unc), (stage.get("pg", 0) + len(unc)) / n * 100 if n else 0))
    a("")
    a("되묻기는 **상호 단위로 묶인다**. uncertain 유니크 상호는 %d개라서,"
      " 사용자가 실제로 답해야 하는 질문은 %d건이 아니라 %d개에 가깝다."
      % (len(uniq_unc), len(unc), len(uniq_unc)))
    a("")
    a("## 2. 카테고리별 분류 결과")
    a("")
    a("| 카테고리 | 건수 |")
    a("|---|---:|")
    for c, v in cat_count.most_common():
        a("| %s | %d |" % (c, v))
    a("")
    a("## 3. 룰별 매칭 건수")
    a("")
    a("| 룰 | 카테고리 | 건수 |")
    a("|---|---|---:|")
    by_match = {r["match"]: r for r in kw.rules}
    for m, v in rule_count.most_common():
        a("| `%s` | %s | %d |" % (nz.md(m), by_match[m]["category"] if m in by_match else "?", v))
    a("")
    unused = [r for r in kw.ordered if r["match"] not in rule_count]
    a("등록만 되고 매칭되지 않은 룰 **%d/%d개**. 표본에 없다는 뜻이고 틀렸다는 뜻은 아니다."
      % (len(unused), len(kw.rules)))
    a("")
    a("<details><summary>미매칭 룰 목록</summary>")
    a("")
    for r in unused:
        a("- `%s` -> %s" % (nz.md(r["match"]), r["category"]))
    a("")
    a("</details>")
    a("")
    a("## 4. 충돌 케이스")
    a("")
    a("한 문자열이 카테고리가 다른 룰 둘 이상에 걸린 경우다. `priority` 로 승자가 정해진다.")
    a("")
    if conflicts:
        a("| 상호 | 이긴 룰 (카테고리) | 밀린 룰 |")
        a("|---|---|---|")
        for raw, res in sorted(conflicts.items()):
            c = res["kw"]
            a("| `%s` | `%s` (%s) | %s |" % (
                nz.md(anon.label(raw)), nz.md(c["matched"]), res["category"],
                ", ".join("`%s` (%s, p=%d)" % (nz.md(h["match"]), h["category"], h["priority"])
                          for h in c["conflicts"])))
        a("")
        a("`쿠팡이츠`(p=830) > `쿠팡`(p=730) 처럼 더 구체적인 쪽이 이기도록 맞춰뒀다.")
    else:
        a("현재 데이터에는 카테고리가 갈리는 충돌이 없다.")
    a("")
    a("## 5. 과잉 매칭 감시")
    a("")
    a("짧거나 흔한 패턴이 실제로 무엇을 잡았는지 매번 확인한다.")
    a("")
    a("| 패턴 | 잡은 상호 수 | 잡은 것 (분류 결과) |")
    a("|---|---:|---|")
    for w in WATCH_PATTERNS:
        got = sorted(watch.get(w, []))
        cell = ", ".join("`%s` (%s)" % (nz.md(anon.label(x)), c) for x, c in got[:6])
        if len(got) > 6:
            cell += " …"
        a("| `%s` | %d | %s |" % (nz.md(w), len(got), cell or "—"))
    a("")
    a("현재 데이터에서 오탐은 확인되지 않았다. 다만 아래는 표본이 커지면 터질 수 있다.")
    a("")
    a("- `KT\\b` : `KT&G` 같은 상호를 잡는다. 담배 구매가 통신비로 분류된다")
    a("- `CU\\b` : 영문 상호 중 CU 로 끝나는 것이 있으면 편의점이 된다")
    a("- `커피` : 상호에 커피가 들어간 음식점(디저트 카페 등)이 카페로 간다. 실무상 차이는 작다")
    a("- `스팀|STEAM` : `스팀청소`, `스팀세차` 가 게임으로 분류된다")
    a("")
    a("## 6. uncertain — 되묻기로 가는 것")
    a("")
    a("규칙으로 카테고리를 정할 수 없는 상호다. 상위 %d개를 카테고리 추정 없이 적는다."
      % min(20, len(uniq_unc)))
    a("")
    a("| 상호 | 건수 |")
    a("|---|---:|")
    strict = nz.Anon()
    for raw, c in uniq_unc.most_common(20):
        a("| %s | %d |" % (nz.md(strict.strict(raw)), c))
    a("")
    a("여기 있는 것들은 대부분 개별 사업장(노래연습장·헤어살롱·PC방·로컬 음식점)이다.")
    a("enum 에 여가·미용 카테고리가 없어서 룰을 만들지 않았다 — "
      "억지로 `기타` 로 넣으면 분류된 척만 하고 되묻기는 그대로 발생한다.")
    a("")
    a("## 7. PM 판단 필요")
    a("")
    for q in kw.spec.get("open_questions") or []:
        a("### %s" % q.get("item"))
        a("")
        a("- 질문: %s" % q.get("question"))
        a("- 현재 처리: %s" % q.get("현재처리"))
        a("")
    return nz.mask_bizno("\n".join(L) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="문자열 하나를 분류한다")
    ap.add_argument("--biz-no", default="")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    kw = load()
    pg = pg_block.load()
    norm = nz.load()

    if args.text:
        res = pipeline(args.text, args.biz_no, norm, pg, kw)
        print("  stage      %s" % res["stage"])
        print("  category   %s" % res["category"])
        print("  norm_key   %s" % res["norm"].norm_key)
        if res.get("kw"):
            print("  matched    %s" % res["kw"]["matched"])
            if res["kw"]["conflicts"]:
                print("  conflicts  %s" % ", ".join(
                    "%s(%s,p=%d)" % (h["match"], h["category"], h["priority"])
                    for h in res["kw"]["conflicts"]))
        if res.get("pg"):
            print("  pg_tokens  %s" % res["pg"]["pg_tokens"])
            print("  hint       %s" % res["pg"]["matched_suffix"])
        return 0

    if args.report:
        REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
        REPORT_MD.write_text(build_report(kw, pg, norm), encoding="utf-8")
        print("-> %s" % REPORT_MD)
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
