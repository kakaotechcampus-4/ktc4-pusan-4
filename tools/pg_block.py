#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
결제대행사(PG) 차단 판정. rules/pg_blocklist.yaml 을 그대로 실행한다.

사전 조회 앞단에서 돌린다. 걸리면 category=PG_미상 / needs_review=true 로
되묻기로 보내고, PG 패턴에 걸리지 않은 토큰은 matched_suffix 로 남긴다.
그 토큰이 되묻기 화면의 힌트가 된다.

사용:
    python tools/pg_block.py --text "토스페이_요기요-(주) 비바리퍼블리카"
    python tools/pg_block.py --report      # docs/pg_blocklist_report.md 생성
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("pyyaml 이 필요합니다:  pip install pyyaml")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize as nz  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
PG_YAML = ROOT / "rules" / "pg_blocklist.yaml"
REPORT_MD = ROOT / "docs" / "pg_blocklist_report.md"


class PGBlocklist:
    def __init__(self, spec: dict) -> None:
        self.spec = spec or {}
        self.on_match = self.spec.get("on_match") or {}
        self.patterns = []
        for p in self.spec.get("patterns") or []:
            self.patterns.append((p.get("match", ""), re.compile(p.get("match", ""), re.I),
                                  p.get("note", "")))

    def raw_patterns(self) -> list[str]:
        return [src for src, _rx, _note in self.patterns]

    def hits(self, text: str) -> list[str]:
        return [src for src, rx, _note in self.patterns if rx.search(str(text))]

    def check(self, raw: str, tokens: list[str] | None = None) -> dict:
        """PG 판정.

        tokens 는 T1 split_delimiters 결과다. 토큰 단위로 봐야
        '어느 토큰이 PG이고 어느 토큰이 서비스명인지' 를 남길 수 있다.
        """
        tokens = [t for t in (tokens or []) if str(t).strip()] or [str(raw)]
        pg_tokens, rest, matched = [], [], []
        for tk in tokens:
            hit = self.hits(tk)
            if hit:
                pg_tokens.append(tk)
                matched.extend(hit)
            else:
                rest.append(tk)

        # 토큰이 하나뿐인데 그 안에 PG 가 섞여 있는 경우(분해 안 된 문자열)
        if not pg_tokens:
            hit = self.hits(raw)
            if hit:
                matched.extend(hit)
                pg_tokens = [str(raw)]
                rest = []

        # '대표' '청구' '일반' 같은 구조 토큰은 힌트가 되지 않는다.
        # 버리지는 않고 dropped 로 남긴다.
        hint = [tk for tk in rest if tk not in nz.GENERIC_TOKENS
                and not re.match(nz.GENERIC_TOKEN_PAT, tk)]
        dropped = [tk for tk in rest if tk not in hint]

        blocked = bool(pg_tokens)
        out = {
            "raw": str(raw),
            "blocked": blocked,
            "pg_tokens": pg_tokens,
            "matched_patterns": sorted(set(matched)),
            # 되묻기 화면 힌트. PG 가 아닌 토큰만 남는다.
            "matched_suffix": hint if blocked else [],
            "dropped_tokens": dropped if blocked else [],
        }
        if blocked:
            # category 는 PG_미상 하나뿐이다. verdict 는 넣지 않는다 — 판정은 룰카드가 한다.
            out["category"] = self.on_match.get("category")
            out["needs_review"] = self.on_match.get("needs_review")
            out["seed_insert"] = self.on_match.get("seed_insert")
        return out


def load() -> PGBlocklist:
    if not PG_YAML.exists():
        sys.exit("rules/pg_blocklist.yaml 이 없습니다")
    with PG_YAML.open(encoding="utf-8") as f:
        return PGBlocklist(yaml.safe_load(f))


# ------------------------------------------------------------------ 리포트
def build_report(pg: PGBlocklist, norm) -> str:
    dom, ovs = nz.load_rows()
    rows = [(r["raw_merchant"], r.get("biz_no", ""), r.get("source_card", "") or "sample")
            for r in dom]
    rows += [(r["raw_merchant"], r.get("biz_no", ""), "overseas") for r in ovs]
    if not rows:
        sys.exit("data/sample.csv 또는 data/overseas_cases.csv 가 필요합니다")

    anon = nz.Anon()
    results = []
    for raw, biz, src in rows:
        r = norm.normalize(raw, biz)
        results.append((src, raw, r, pg.check(raw, r.tokens or [r.string_norm])))

    blocked = [(src, raw, r, c) for src, raw, r, c in results if c["blocked"]]
    uniq_blocked: dict[str, tuple] = {}
    for src, raw, r, c in blocked:
        uniq_blocked.setdefault(raw, (src, r, c))

    with_hint = {k: v for k, v in uniq_blocked.items() if v[2]["matched_suffix"]}
    no_hint = {k: v for k, v in uniq_blocked.items() if not v[2]["matched_suffix"]}

    pat_count: Counter = Counter()
    for _src, _raw, _r, c in blocked:
        for p in c["matched_patterns"]:
            pat_count[p] += 1

    L = []
    a = L.append
    a("# T2 결제대행사 차단 목록 리포트")
    a("")
    a("`rules/pg_blocklist.yaml` 을 실제 카드 내역에 적용한 결과다.")
    a("상호명 익명화는 T1과 같은 규칙을 쓴다 — 브랜드는 남기고 지점명은 지운다.")
    a("")
    a("생성: `python tools/pg_block.py --report`")
    a("")
    a("## 1. 매칭 건수")
    a("")
    a("| | 건수 |")
    a("|---|---:|")
    a("| 검사한 행 | %d |" % len(results))
    a("| PG 차단 | %d |" % len(blocked))
    a("| PG 차단 (유니크 상호) | %d |" % len(uniq_blocked))
    a("| 등록 패턴 | %d |" % len(pg.patterns))
    a("| 매칭된 패턴 | %d |" % len(pat_count))
    a("")
    a("차단된 행은 `category: %s` / `needs_review: %s` / `seed_insert: %s` 로 나간다."
      % (pg.on_match.get("category"), pg.on_match.get("needs_review"),
         pg.on_match.get("seed_insert")))
    a("**`verdict` 는 없다.** 판정은 6관문 룰카드가 한다.")
    a("")
    a("### 패턴별 매칭")
    a("")
    a("| 패턴 | 건수 |")
    a("|---|---:|")
    for p, c in pat_count.most_common():
        a("| `%s` | %d |" % (nz.md(p), c))
    unused = [p for p in pg.raw_patterns() if p not in pat_count]
    a("")
    a("등록만 되고 현재 데이터에서 매칭되지 않은 패턴 %d개:" % len(unused))
    a("")
    for p in unused:
        a("- `%s`" % nz.md(p))
    a("")
    a("표본에 없다는 뜻이지 틀렸다는 뜻은 아니다. 다만 검증되지 않았다.")
    a("")
    a("## 2. matched_suffix 확보율")
    a("")
    rate = len(with_hint) / len(uniq_blocked) * 100 if uniq_blocked else 0
    a("차단된 상호 중 **%d/%d (%.1f%%)** 에서 PG 가 아닌 토큰을 하나 이상 건졌다."
      % (len(with_hint), len(uniq_blocked), rate))
    a("이 토큰이 되묻기 화면의 힌트가 된다 — 사용자가 \"이게 뭐였지\" 를 덜 겪는다.")
    a("")
    a("| 상호 | PG 토큰 | 힌트 (matched_suffix) |")
    a("|---|---|---|")
    for raw, (_src, r, c) in sorted(with_hint.items()):
        a("| `%s` | %s | %s |" % (
            nz.md(anon.label(raw)),
            ", ".join("`%s`" % nz.md(anon.label(t)) for t in c["pg_tokens"]),
            ", ".join("`%s`" % nz.md(anon.label(t)) for t in c["matched_suffix"])))
    a("")
    a("## 3. 힌트 없는 케이스")
    a("")
    if no_hint:
        a("전체 토큰이 PG 라서 남는 게 없다. 되묻기 화면에 보여줄 단서가 상호명뿐이다.")
        a("")
        a("| 상호 | 걸린 패턴 |")
        a("|---|---|")
        for raw, (_src, r, c) in sorted(no_hint.items()):
            a("| `%s` | %s |" % (
                nz.md(anon.label(raw)),
                ", ".join("`%s`" % nz.md(p) for p in c["matched_patterns"])))
        a("")
        a("이 경우 금액·날짜 외에는 단서가 없다. KB 파일의 사용자 메모 컬럼이")
        a("유일하게 남은 단서라서(구글플레이 -> Onedrive/Gemini/GPT) 되묻기 화면에")
        a("메모를 같이 띄우는 것이 좋겠다.")
    else:
        a("현재 데이터에는 없다.")
    a("")
    a("## 4. PG 가 아니라고 판단한 것")
    a("")
    a("PG 처럼 보이지만 \"뒤에 뭐가 붙어도 카테고리가 안 변하는\" 것들이다.")
    a("차단하면 매달 반복되는 확정 지출이 매달 되묻기로 간다.")
    a("")
    a("| 상호 | 이유 | 처리 |")
    a("|---|---|---|")
    for name, why in NOT_PG:
        hit = pg.hits(name)
        a("| `%s` | %s | %s |" % (
            nz.md(name), why,
            "차단 안 됨 (확인)" if not hit else "**차단됨 — 패턴 재검토 필요**"))
    a("")
    a("## 5. PM 판단 필요")
    a("")
    for q in pg.spec.get("open_questions") or []:
        a("### %s" % q.get("item"))
        a("")
        a("- 질문: %s" % q.get("question"))
        a("- 현재 처리: %s" % q.get("현재처리"))
        if q.get("실증"):
            a("- 실증: %s" % q.get("실증"))
        a("")
    return nz.mask_bizno("\n".join(L) + "\n")


# 판별식상 PG 가 아닌 것. 리포트에서 매번 회귀 검사한다.
NOT_PG = [
    ("배민클럽_우아한형제들-배민클럽_우아한형제들", "배달의민족 구독. 우아한형제들 자체 상품"),
    ("삼성닷컴_청구-삼성전자(주)", "삼성 자체 청구"),
    ("구글클라우드코리아", "GCP. 실제 서비스명"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="문자열 하나를 판정한다")
    ap.add_argument("--report", action="store_true", help="docs/pg_blocklist_report.md 생성")
    args = ap.parse_args()

    pg = load()
    norm = nz.load()

    if args.text:
        r = norm.normalize(args.text)
        c = pg.check(args.text, r.tokens or [r.string_norm])
        for k, v in c.items():
            print("  %-17s %s" % (k, v))
        return 0

    if args.report:
        REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
        REPORT_MD.write_text(build_report(pg, norm), encoding="utf-8")
        print("-> %s" % REPORT_MD)
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
