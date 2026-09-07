#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
룰/사전 데이터 검증기.

사용:
    python tools/validate_rules.py            # 전체 검사
    python tools/validate_rules.py --normalize "스타벅스코리아 강남대로점"

검사 항목
  C1. merchant_seed.csv 스키마 — raw_merchant/category 필수,
      norm_key/merchant_norm 금지 (정규화 엔진 이중화 방지)
  C2. 사전/키워드룰에 verdict / account 컬럼(키)이 없는가
  C3. category 값이 전부 enum 안에 있는가
  C4. PG 블록리스트에 걸리는 문자열이 사전에 들어가 있지 않은가
  C5. 룰카드 YAML 규율
        - type: learned 인데 priority > 400
        - type: learned 인데 gate: G1
        - type: learned 인데 citations 가 비어있지 않음
        - citations 의 verified: false 인데 id 가 TODO 가 아님 (그 반대도)
  C6. 같은 raw_merchant 에 다른 category 가 붙었는지

아직 만들지 않은 파일은 SKIP 으로 표시하고 통과시킨다.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("pyyaml 이 필요합니다:  pip install pyyaml")

# Windows 콘솔(cp949)에서 한글이 깨지지 않게
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
NORMALIZE_YAML = ROOT / "rules" / "normalize.yaml"
PG_BLOCKLIST_YAML = ROOT / "rules" / "pg_blocklist.yaml"
KEYWORD_RULES_YAML = ROOT / "rules" / "keyword_rules.yaml"
MERCHANT_SEED_CSV = ROOT / "seeds" / "merchant_seed.csv"
RULECARD_GLOB = "R-*.yaml"

# ---------------------------------------------------------------- category enum
CATEGORY_ENUM = [
    "카페", "음식점", "편의점", "온라인쇼핑", "음식배달",
    "해외SaaS", "국내SW", "통신", "수도광열", "여비교통", "차량",
    "도서", "교육", "광고", "사무용품", "의료", "금융",
    "지자체_과태료", "경찰청_범칙금", "조세", "PG_미상", "기타",
    # T3 에서 추가 (PM 승인). 업종 세분화가 아니라 G2(사업관련성)에서
    # 다르게 처리되는지가 분리 기준이다.
    #   게임·여가·미용  -> 사업 무관 후보
    #   구독서비스      -> 업무용 가능
    #   생활용품        -> 사업/개인 혼재
    # 노래방·PC방·볼링은 세무 판정이 같으므로 '여가' 하나로 묶는다. 업종별로 쪼개지 않는다.
    "게임", "구독서비스", "여가", "미용", "생활용품",
]


# 사전·키워드룰에 절대 들어오면 안 되는 키 (판정은 룰카드 소관)
FORBIDDEN_KEYS = {"verdict", "account", "판정", "계정과목", "계정", "deductible"}

SEED_REQUIRED_COLS = ["raw_merchant", "category"]

# 사전에 정규화 키를 박아두면 안 된다.
# CSV 에 norm_key 가 있으면 Python 엔진이 만든 키를 Java 엔진도 똑같이 만들어야 한다.
# 엔진이 둘이 되는 순간, 한쪽만 고쳐졌을 때 사전 히트율이 조용히 0% 가 된다.
# 키 계산은 적재 시점에 백엔드가 한다.
SEED_BANNED_COLS = {"norm_key", "merchant_norm", "norm", "key"}

# 지점명은 생활권 정보다. 저장 위치 경계:
#   merchant_dict (전 사용자 공용) -> 금지
#   transaction   (사용자 본인)    -> 가능
#   user_rules    (사용자 본인)    -> 가능
SEED_BANNED_BRANCH_COLS = {"branch", "branch_raw", "branch_name",
                           "지점", "지점명", "매장", "점포"}


# ---------------------------------------------------------------- 결과 수집
class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warns: list[str] = []
        self.infos: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warns.append(msg)

    def info(self, msg: str) -> None:
        self.infos.append(msg)

    def dump(self) -> int:
        for m in self.infos:
            print("  ok   " + m)
        for m in self.warns:
            print("  WARN " + m)
        for m in self.errors:
            print("  FAIL " + m)
        print()
        print("errors=%d  warnings=%d" % (len(self.errors), len(self.warns)))
        return 1 if self.errors else 0


# ---------------------------------------------------------------- 정규화 엔진
# 구현은 tools/normalize.py 한 곳뿐이다. 여기서 다시 만들면 사전의 norm_key 와
# 엔진 결과가 조용히 갈라진다.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalize import Normalizer  # noqa: E402


def load_yaml(path: Path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_seed(path: Path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------- 검사들
def check_normalize_spec(rep: Report, spec):
    print("[T1] normalize.yaml")
    if spec is None:
        rep.info("SKIP - 파일 없음 (T1 미완)")
        return None
    try:
        norm = Normalizer(spec)
    except Exception as e:  # noqa: BLE001
        rep.error("normalize.yaml 로드 실패: %s" % e)
        return None

    for step in spec.get("steps") or []:
        for pat in step.get("patterns") or []:
            try:
                re.compile(pat)
            except re.error as e:
                rep.error("정규식 오류 step=%s pattern=%r: %s" % (step.get("id"), pat, e))

    cases = spec.get("test_cases") or []
    if not cases:
        rep.warn("test_cases 가 비어 있다")
    ok = 0
    for c in cases:
        try:
            got = norm.string_key(c["in"])
        except Exception as e:  # noqa: BLE001
            rep.error("test_case 실행 실패 in=%r: %s" % (c.get("in"), e))
            continue
        if got != c["out"]:
            rep.error("test_case 불일치: %r -> %r (기대 %r)" % (c["in"], got, c["out"]))
        else:
            ok += 1
    if ok:
        rep.info("test_cases %d/%d 통과" % (ok, len(cases)))
    return norm


def check_seed(rep: Report, rows, norm):
    print("[T4] seeds/merchant_seed.csv")
    if rows is None:
        rep.info("SKIP - 파일 없음 (T4 미완)")
        return
    if not rows:
        rep.error("사전이 비어 있다")
        return

    n0 = len(rep.errors)
    cols = list(rows[0].keys())

    # 판정 금지 (사전은 "이게 무엇인가" 만 저장한다)
    bad = [c for c in cols if str(c).strip().lower() in FORBIDDEN_KEYS]
    if bad:
        rep.error("금지 컬럼 존재: %s - 사전은 category 만 정한다" % bad)

    # 정규화 키 금지 (엔진 이중화 방지)
    banned = [c for c in cols if str(c).strip().lower() in SEED_BANNED_COLS]
    if banned:
        rep.error("정규화 키 컬럼 존재: %s - 키는 적재 시점에 계산한다 "
                  "(CSV 에 박으면 Python/Java 엔진이 갈라진다)" % banned)

    # 지점명 금지 (전 사용자 공용 사전이다)
    branch_cols = [c for c in cols if str(c).strip().lower() in SEED_BANNED_BRANCH_COLS]
    if branch_cols:
        rep.error("지점명 컬럼 존재: %s - 지점명은 생활권 정보다. 공용 사전에 넣지 않는다 "
                  "(transaction/user_rules 에만 저장)" % branch_cols)

    missing = [c for c in SEED_REQUIRED_COLS if c not in cols]
    if missing:
        rep.error("필수 컬럼 누락: %s" % missing)
        return

    seen: dict[str, tuple] = {}
    for i, r in enumerate(rows, start=2):
        raw = (r.get("raw_merchant") or "").strip()
        cat = (r.get("category") or "").strip()
        if not raw:
            rep.error("line %d: raw_merchant 비어 있음" % i)
            continue
        if cat not in CATEGORY_ENUM:
            rep.error("line %d: category '%s' 가 enum 밖 (raw_merchant=%s)" % (i, cat, raw))
        # 같은 상호에 다른 카테고리가 붙으면 적재 순서에 따라 결과가 달라진다
        if raw in seen:
            prev_cat, prev_line = seen[raw]
            if prev_cat != cat:
                rep.error("line %d: '%s' 가 line %d 에서는 '%s', 여기서는 '%s' "
                          "- 같은 상호는 한 카테고리여야 한다"
                          % (i, raw, prev_line, prev_cat, cat))
        else:
            seen[raw] = (cat, i)
    if len(rep.errors) == n0:
        rep.info("사전 %d건 / 유니크 상호 %d개 검사 통과" % (len(rows), len(seen)))


def check_keyword_rules(rep: Report, spec):
    print("[T3] rules/keyword_rules.yaml")
    if spec is None:
        rep.info("SKIP - 파일 없음 (T3 미완)")
        return
    n0 = len(rep.errors)
    rules = spec.get("rules") or []
    if not rules:
        rep.error("rules 가 비어 있다")
        return
    for i, r in enumerate(rules):
        bad = [k for k in r if str(k).strip().lower() in FORBIDDEN_KEYS]
        if bad:
            rep.error("rules[%d]: 금지 키 %s - 판정은 룰카드가 한다" % (i, bad))
        cat = r.get("category")
        if cat == "uncertain":
            # 확정 분류가 아니라 되묻기로 보내는 룰이다.
            if not r.get("needs_review"):
                rep.error("rules[%d]: category=uncertain 인데 needs_review 가 없다 "
                          "(분류도 안 하고 되묻기도 안 하면 그냥 사라진다)" % i)
            if not r.get("hint"):
                rep.warn("rules[%d]: category=uncertain 인데 hint 가 없다 "
                         "(되묻기 화면에서 질문을 좁힐 단서가 없다)" % i)
        elif cat not in CATEGORY_ENUM:
            rep.error("rules[%d]: category '%s' 가 enum 밖 (match=%r)" % (i, cat, r.get("match")))
        try:
            re.compile(r.get("match", ""))
        except re.error as e:
            rep.error("rules[%d]: 정규식 오류 %r: %s" % (i, r.get("match"), e))
    if len(rep.errors) == n0:
        rep.info("키워드룰 %d건 검사 통과" % len(rules))


def check_pg_vs_seed(rep: Report, pg, rows):
    print("[T2] rules/pg_blocklist.yaml x 사전 교차검사")
    if pg is None:
        rep.info("SKIP - 파일 없음 (T2 미완)")
        return
    n0 = len(rep.errors)
    on_match = pg.get("on_match") or {}
    if on_match.get("category") != "PG_미상":
        rep.error("on_match.category 는 PG_미상 이어야 한다")
    if on_match.get("seed_insert") is not False:
        rep.error("on_match.seed_insert 는 false 여야 한다 (사전 등록 금지)")
    if on_match.get("needs_review") is not True:
        rep.error("on_match.needs_review 는 true 여야 한다")

    pats = pg.get("patterns") or []
    compiled = []
    for i, p in enumerate(pats):
        try:
            compiled.append((p.get("match"), re.compile(p.get("match", ""), re.I)))
        except re.error as e:
            rep.error("patterns[%d]: 정규식 오류 %r: %s" % (i, p.get("match"), e))
    if rows:
        for i, r in enumerate(rows, start=2):
            key = (r.get("raw_merchant") or "").strip()
            for src, rx in compiled:
                if key and rx.search(key):
                    rep.error(
                        "seed line %d: '%s' 가 PG 블록리스트 %r 에 걸린다 - 사전에서 제외"
                        % (i, key, src)
                    )
    if len(rep.errors) == n0:
        rep.info("PG 패턴 %d건, 사전 교차검사 통과" % len(pats))


def check_rulecards(rep: Report):
    print("[T6] rules/R-*.yaml")
    files = sorted((ROOT / "rules").glob(RULECARD_GLOB))
    if not files:
        rep.info("SKIP - 룰카드 없음 (T6 미완)")
        return
    n0 = len(rep.errors)
    for f in files:
        card = load_yaml(f) or {}
        rid = card.get("id", f.name)
        ctype = card.get("type")
        gate = card.get("gate")
        prio = card.get("priority")
        cits = card.get("citations") or []

        if ctype == "learned":
            if isinstance(prio, int) and prio > 400:
                rep.error("%s: type=learned 인데 priority=%s (>400 금지)" % (rid, prio))
            if gate == "G1":
                rep.error("%s: type=learned 인데 gate=G1 (불산입 관문 금지)" % rid)
            if cits:
                rep.error("%s: type=learned 인데 citations 가 비어있지 않음" % rid)
        elif ctype == "statutory":
            if not cits:
                rep.error("%s: type=statutory 인데 citations 가 비어 있음" % rid)

        for c in cits:
            verified = c.get("verified")
            cid = c.get("id")
            if verified is False and str(cid) != "TODO":
                rep.error("%s: citation verified=false 인데 id=%r (TODO 여야 함)" % (rid, cid))
            if verified is True and str(cid) == "TODO":
                rep.error("%s: citation verified=true 인데 id 가 TODO" % rid)

        for opt in ((card.get("ask") or {}).get("options") or []):
            v = opt.get("verdict")
            if v not in (None, "가능", "불가", "되묻기"):
                rep.error("%s: ask.options verdict 값이 이상함: %r" % (rid, v))
    if len(rep.errors) == n0:
        rep.info("룰카드 %d장 검사 통과" % len(files))



# 문서에 마스킹 안 된 식별번호가 남는 것을 막는다.
# 이 repo 는 public 이고, 리포트는 카드 내역에서 자동 생성된다.
# (정규식에 백슬래시를 쓰지 않는다 — 문자 클래스로 충분하고 이스케이프 사고가 없다)
DOC_LEAK_PATTERNS = [
    ("사업자번호", "[0-9]{3}-[0-9]{2}-[0-9]{5}", "107-86-***47 처럼 마스킹할 것"),
    ("카드번호", "[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}", "문서에 카드번호를 쓰지 말 것"),
    ("계좌번호", "[0-9]{6}-[0-9]{2}-[0-9]{6}", "문서에 계좌번호를 쓰지 말 것"),
]
# 마스킹된 형태는 통과시킨다
DOC_ALLOW = re.compile("[0-9]{3}-[0-9]{2}-[*]{3}[0-9]{2}")


def literal_of(alt: str) -> str:
    """정규식 대안 하나에서 문자 그대로인 부분만 뽑는다.

    PG 패턴이 키워드룰에도 들어가 있는지 보려면, 패턴을 실제 문자열처럼
    만들어 키워드룰에 넣어봐야 한다.
    """
    s = alt
    s = re.sub(r"\\s[*+]", " ", s)         # 문자열 "\s*" -> 공백 한 칸
    s = re.sub(r"\([^)]*\)\?", "", s)      # "(MENT)?" -> 선택 그룹 제거
    s = re.sub(r"\\b", "", s)              # 단어 경계 표기 제거
    s = re.sub(r"[()\[\]?*+^$]", "", s)
    s = s.replace("\\", "")                # 남은 이스케이프 백슬래시
    return s.strip()


def check_pg_vs_keyword(rep: Report, pg, kw) -> None:
    """PG 는 차단 대상이다. 같은 문자열이 키워드룰에도 있으면 분류가 갈린다."""
    print("[T2xT3] PG 블록리스트 x 키워드룰 교차검사")
    if pg is None or kw is None:
        rep.info("SKIP - 한쪽 파일이 없음")
        return
    n0 = len(rep.errors)
    rules = []
    for i, r in enumerate(kw.get("rules") or []):
        try:
            rules.append((i, r.get("match", ""), re.compile(r.get("match", ""), re.I),
                          r.get("category")))
        except re.error:
            continue
    checked = 0
    for p in pg.get("patterns") or []:
        for alt in str(p.get("match", "")).split("|"):
            lit = literal_of(alt)
            if len(lit) < 3:
                continue
            checked += 1
            for i, src, rx, cat in rules:
                if rx.search(lit):
                    rep.error("PG '%s' 가 키워드룰[%d] %r (category=%s) 에도 걸린다 "
                              "- PG 는 차단 대상이므로 키워드룰에서 빼야 한다"
                              % (lit, i, src, cat))
    if len(rep.errors) == n0:
        rep.info("PG 문자열 %d개, 키워드룰과 겹치지 않음" % checked)


def check_docs(rep: Report) -> None:
    print("[문서] docs/*.md 마스킹 검사")
    docs = sorted((ROOT / "docs").glob("*.md"))
    if not docs:
        rep.info("SKIP - docs/*.md 없음")
        return
    n0 = len(rep.errors)
    for f in docs:
        text = f.read_text(encoding="utf-8")
        for lineno, line in enumerate(text.splitlines(), start=1):
            masked_spans = [m.span() for m in DOC_ALLOW.finditer(line)]
            for label, pat, hint in DOC_LEAK_PATTERNS:
                for m in re.finditer(pat, line):
                    if any(s <= m.start() and m.end() <= e for s, e in masked_spans):
                        continue
                    rep.error("%s:%d 마스킹 안 된 %s '%s' - %s"
                              % (f.name, lineno, label, m.group(0), hint))
    if len(rep.errors) == n0:
        rep.info("문서 %d개 통과" % len(docs))


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--normalize", metavar="TEXT", help="문자열 하나를 정규화해 본다")
    args = ap.parse_args()

    nspec = load_yaml(NORMALIZE_YAML)

    if args.normalize:
        if nspec is None:
            sys.exit("normalize.yaml 이 아직 없다")
        print(Normalizer(nspec).string_key(args.normalize))
        return 0

    rep = Report()
    norm = check_normalize_spec(rep, nspec)
    rows = load_seed(MERCHANT_SEED_CSV)
    check_keyword_rules(rep, load_yaml(KEYWORD_RULES_YAML))
    check_pg_vs_seed(rep, load_yaml(PG_BLOCKLIST_YAML), rows)
    check_seed(rep, rows, norm)
    check_rulecards(rep)
    check_pg_vs_keyword(rep, load_yaml(PG_BLOCKLIST_YAML), load_yaml(KEYWORD_RULES_YAML))
    check_docs(rep)
    print()
    return rep.dump()


if __name__ == "__main__":
    sys.exit(main())
