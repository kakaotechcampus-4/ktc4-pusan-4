#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
가맹점명 정규화 엔진. rules/normalize.yaml 을 그대로 실행한다.

이 파일이 정규화의 유일한 구현이다. validate_rules.py 도 여기서 가져다 쓴다
(구현이 둘이면 사전의 norm_key 와 엔진 결과가 조용히 갈라진다).

사용:
    python tools/normalize.py --text "스타벅스코리아 강남대로점"
    python tools/normalize.py --selftest
    python tools/normalize.py --report        # docs/normalize_report.md 생성
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("pyyaml 이 필요합니다:  pip install pyyaml")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
NORMALIZE_YAML = ROOT / "rules" / "normalize.yaml"
SAMPLE_CSV = ROOT / "data" / "sample.csv"
OVERSEAS_CSV = ROOT / "data" / "overseas_cases.csv"
REPORT_MD = ROOT / "docs" / "normalize_report.md"

BIZNO_PAT = re.compile("([0-9]{3})-([0-9]{2})-([0-9]{5})")


def mask_bizno(s) -> str:
    """사업자번호를 마스킹한다.

    법인 사업자번호 자체는 공개정보지만, '번호 + 상호 + 우리 카드 내역' 이
    한 문서에 모이면 개인 거래 정보가 된다. 이 repo 는 public 이다.
    끝 두 자리는 남긴다 — 같은 번호로 묶였다는 사실은 그대로 보여야 한다.
    """
    return BIZNO_PAT.sub(lambda m: "%s-%s-***%s" % (m.group(1), m.group(2), m.group(3)[-2:]), str(s))


def md(s) -> str:
    """마크다운 표 셀용. '|' 를 이스케이프하지 않으면 컬럼이 깨진다."""
    return str(s).replace("|", r"\|")


ASCII_LETTER = re.compile(r"[A-Za-z]")
LETTER = re.compile(r"[A-Za-z가-힣]")


class Result(dict):
    """정규화 결과. dict 이지만 속성으로도 읽는다."""

    def __getattr__(self, k):
        try:
            return self[k]
        except KeyError as e:
            raise AttributeError(k) from e


class Normalizer:
    def __init__(self, spec: dict) -> None:
        self.spec = spec or {}
        self.steps = self.spec.get("steps") or []
        self.exceptions = list(self.spec.get("exceptions") or [])
        self._exc_bare = [self._bare(e) for e in self.exceptions]
        det = self.spec.get("detect") or {}
        self.trunc = det.get("truncation") or {}
        self.overseas = det.get("overseas") or {}

    # ------------------------------------------------------------ 유틸
    @staticmethod
    def _bare(s: str) -> str:
        return re.sub(r"[\s.\-*#/&,'\"()\[\]|]", "", str(s)).upper()

    def _enc_len(self, s: str) -> int:
        enc = self.trunc.get("encoding", "euc-kr")
        try:
            return len(s.encode(enc, "replace"))
        except LookupError:
            return len(s.encode("utf-8"))

    # ------------------------------------------------------------ 스텝
    def step_trim_normalize_space(self, s, ctx, step):
        return re.sub(r"\s+", " ", s).strip()

    def step_fullwidth_to_halfwidth(self, s, ctx, step):
        return unicodedata.normalize("NFKC", s)

    def step_detect_truncation(self, s, ctx, step):
        max_bytes = int(self.trunc.get("max_bytes", 20))
        ctx["enc_bytes"] = self._enc_len(s)
        # '이상' 이 아니라 '정확히 한계값' 이다. 카드사가 20바이트에서 자르므로
        # 20을 넘는 문자열은 애초에 안 온다. >= 로 두면 20바이트가 넘는 정상
        # 입력(테스트 케이스 등)까지 절단으로 오판한다.
        ctx["is_truncated"] = ctx["enc_bytes"] == max_bytes
        return s

    def step_strip_corp(self, s, ctx, step):
        for pat in step.get("patterns") or []:
            s = re.sub(pat, "", s)
        return re.sub(r"\s+", " ", s).strip()

    @staticmethod
    def _split_on(text, delims):
        if not delims:
            return [text.strip()] if text.strip() else []
        pat = "[" + re.escape("".join(delims)) + "]"
        return [t.strip() for t in re.split(pat, text) if t.strip()]

    def step_split_delimiters(self, s, ctx, step):
        """구분자로 자르되 토큰을 하나도 버리지 않는다.

        '-' 는 상호명 안에도 쓰이므로("이랜드리테일 부산대점-푸드코트")
        토큰이 conditional_min_tokens 이상 나오거나 PG 힌트가 보일 때만 자른다.
        그렇지 않으면 원문을 유지하고 ctx 에 기록해 리포트로 뽑는다.
        """
        always = list(step.get("always") or ["*"])
        cond = list(step.get("conditional") or [])
        min_tokens = int(step.get("conditional_min_tokens", 3))
        hints = [re.compile(h, re.I) for h in (step.get("pg_hints") or [])]

        for pat in step.get("preserve") or []:
            if re.search(pat, s):
                return s

        has_always = any(d in s for d in always)
        has_cond = any(d in s for d in cond)
        if not (has_always or has_cond):
            return s

        tok_all = self._split_on(s, always + cond)
        tok_always = self._split_on(s, always) if has_always else [s.strip()]
        pg_hit = next((h.pattern for h in hints if h.search(s)), None)
        ctx["pg_hint"] = pg_hit

        # 잘라낸 토큰이 전부 같은 문자열이면 같은 곳을 두 번 적은 것이다.
        # "KIS정보통신-KIS정보통신", "(주)우아한형제들-주식회사 우아한형제들"
        if len(tok_all) > 1 and len(set(tok_all)) == 1:
            ctx["collapsed"] = True
            ctx["tokens"] = [tok_all[0]]
            return tok_all[0]

        if has_cond:
            if len(tok_all) >= min_tokens or pg_hit:
                tokens = tok_all
                ctx["cond_split"] = True
            else:
                # 오분해 방지 — 상호명 안의 하이픈일 가능성이 높다
                tokens = tok_always
                ctx["cond_kept"] = True
        else:
            tokens = tok_always

        if step.get("collapse_repeats"):
            uniq = []
            for tk in tokens:
                if tk not in uniq:
                    uniq.append(tk)
            if len(uniq) != len(tokens):
                ctx["collapsed"] = True
            tokens = uniq

        ctx["tokens"] = tokens
        return step.get("join", "|").join(tokens)

    def step_strip_special(self, s, ctx, step):
        chars = step.get("chars", r"[.*#/&,'\"()\[\]_~\\]")
        return re.sub(chars, "", s)

    def step_upper_ascii(self, s, ctx, step):
        return "".join(c.upper() if c.isascii() else c for c in s)

    def step_strip_branch(self, s, ctx, step):
        if step.get("skip_if_truncated") and ctx.get("is_truncated"):
            # 절단된 상호는 지점 표기 자체가 잘려나갔다. 억지로 파싱하지 않고
            # 손대지 못한 문자열을 branch_raw 로만 남긴다.
            ctx["branch_skipped"] = True
            ctx["branch_raw"] = s
            return s
        min_keep = int(step.get("min_keep", 2))
        for pat in step.get("patterns") or []:
            cand = re.sub(pat, "", s).strip()
            if cand != s and len(cand) >= min_keep:
                ctx["branch_pattern"] = pat
                # 떼어낸 부분이 지점명이다. 버리지 않고 보존한다.
                # (공용 사전에는 절대 넣지 않는다 — 생활권 정보다)
                ctx["branch"] = s[len(cand):].strip() if s.startswith(cand) else                     re.sub(re.escape(cand), "", s, count=1).strip()
                return cand
            if cand != s:
                # min_keep 에 걸렸다 — 통째로 사라질 뻔했다는 뜻이므로 기록만 한다
                ctx.setdefault("branch_blocked", []).append(pat)
        return s

    def step_protect_exceptions(self, s, ctx, step):
        for exc, bare in zip(self.exceptions, self._exc_bare):
            if bare and bare in ctx["bare_input"] and bare not in self._bare(s):
                # 예외 토큰이 축약 과정에서 사라졌다 -> 사라지기 직전 값으로 되돌린다
                for prev in reversed(ctx["history"]):
                    if bare in self._bare(prev):
                        ctx.setdefault("protected", []).append(exc)
                        return prev
        return s

    def step_drop_space(self, s, ctx, step):
        return s.replace(" ", "")

    # ------------------------------------------------------------ 실행
    def run_pipeline(self, raw: str) -> tuple[str, dict]:
        s = str(raw)
        ctx = {"bare_input": self._bare(raw), "history": [], "is_truncated": False}
        for step in self.steps:
            sid = step.get("id")
            fn = getattr(self, "step_" + str(sid), None)
            if fn is None:
                raise ValueError("normalize.yaml: 알 수 없는 step id '%s'" % sid)
            ctx["history"].append(s)
            s = fn(s, ctx, step)
        return s.strip(), ctx

    def is_overseas(self, raw: str, biz_no: str, ctx: dict) -> bool:
        if self.overseas.get("require_no_bizno", True) and biz_no:
            return False
        letters = LETTER.findall(str(raw))
        if not letters:
            return False
        ascii_ratio = len(ASCII_LETTER.findall(str(raw))) / len(letters)
        return ascii_ratio >= float(self.overseas.get("ascii_letter_ratio_min", 0.5))

    def normalize(self, raw: str, biz_no: str = "") -> Result:
        """3트랙 키 전략을 적용해 norm_key 를 결정한다."""
        s, ctx = self.run_pipeline(raw)
        biz_no = (biz_no or "").strip()
        overseas = self.is_overseas(raw, biz_no, ctx)

        if biz_no:
            track, key = "bizno", biz_no
        elif overseas:
            track, key = "overseas", s
        else:
            track, key = "string", s

        return Result(
            raw=str(raw),
            norm_key=key,
            track=track,
            string_norm=s,
            overseas_norm=s if overseas else "",
            tokens=ctx.get("tokens") or [],
            is_truncated=bool(ctx.get("is_truncated")),
            is_overseas=overseas,
            enc_bytes=ctx.get("enc_bytes", 0),
            branch_skipped=bool(ctx.get("branch_skipped")),
            branch_blocked=ctx.get("branch_blocked") or [],
            protected=ctx.get("protected") or [],
            branch=ctx.get("branch", ""),
            branch_raw=ctx.get("branch_raw", ""),
            pg_hint=ctx.get("pg_hint"),
            cond_split=bool(ctx.get("cond_split")),
            cond_kept=bool(ctx.get("cond_kept")),
            collapsed=bool(ctx.get("collapsed")),
        )

    def string_key(self, raw: str) -> str:
        """문자열 트랙 결과만 필요할 때 (사전 norm_key 검증용)."""
        return self.run_pipeline(raw)[0]


PG_YAML = ROOT / "rules" / "pg_blocklist.yaml"


def load() -> Normalizer:
    if not NORMALIZE_YAML.exists():
        sys.exit("rules/normalize.yaml 이 없습니다")
    with NORMALIZE_YAML.open(encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    # PG 힌트의 정식 출처는 rules/pg_blocklist.yaml 이다.
    # 두 파일에 목록을 따로 두면 한쪽만 고쳐지고 갈라진다.
    if PG_YAML.exists():
        with PG_YAML.open(encoding="utf-8") as f:
            pg = yaml.safe_load(f) or {}
        pats = [p.get("match") for p in (pg.get("patterns") or []) if p.get("match")]
        PG_SAFE_PATTERNS[:] = pats
        if pats:
            for step in spec.get("steps") or []:
                if step.get("id") == "split_delimiters":
                    step["pg_hints"] = pats
    return Normalizer(spec)


# ------------------------------------------------------------------ 자체 테스트
def selftest(norm: Normalizer) -> int:
    cases = norm.spec.get("test_cases") or []
    bad = 0
    for c in cases:
        got = norm.string_key(c["in"])
        ok = got == c["out"]
        bad += 0 if ok else 1
        print("  %s  %-26r -> %-22r %s" % (
            "ok  " if ok else "FAIL", c["in"], got, "" if ok else "(기대 %r)" % c["out"]))
    print("\n  %d/%d 통과" % (len(cases) - bad, len(cases)))
    return 1 if bad else 0


# ------------------------------------------------------------------ 리포트
def load_rows() -> tuple[list[dict], list[dict]]:
    dom = list(csv.DictReader(SAMPLE_CSV.open(encoding="utf-8"))) if SAMPLE_CSV.exists() else []
    ovs = list(csv.DictReader(OVERSEAS_CSV.open(encoding="utf-8"))) if OVERSEAS_CSV.exists() else []
    return dom, ovs



class Anon:
    """리포트 표시용 익명화.

    브랜드명은 남기고 지점명만 지운다. 지점명이 생활권을 드러내기 때문이다
    (같은 편의점 25회 = 거주지 추정). 브랜드를 통째로 지우면 리포트가
    "기타 A + 기타 B" 가 되어 읽을 수 없으므로, 구분자로 자른 토큰마다
    따로 판단한다.

      GS25부산의대학사점              -> GS25***
      맘스터치_3-맘스터치(부산대북문점2) -> 맘스터치_3-맘스터치***
      하이오커피 해운대 우             -> 카페 A        (브랜드 미확인)
      교통-버스1건                   -> 그대로         (가맹점이 아님)
    """

    SPLIT = re.compile("[*_-]")
    BRANCH = re.compile("점|지점|매장|영업소")

    def __init__(self) -> None:
        self.map: dict[str, str] = {}
        self.seq: Counter = Counter()
        self.taken: dict[str, str] = {}   # 라벨 -> 그 라벨을 처음 받은 원문

    @staticmethod
    def _bare_tok(tok: str) -> str:
        """괄호·공백·기호와 법인 표기를 털어낸다."""
        s = re.sub("[^0-9A-Za-z가-힣]", "", tok)
        s = re.sub("^(주식회사|유한회사|주|유)", "", s)
        return re.sub("(주식회사|유한회사|주|유)$", "", s)

    @classmethod
    def _brand_only(cls, tok: str, brand: str) -> bool:
        """브랜드 뒤에 지점명이 붙어 있는지 판단한다.

        남은 부분이 없거나, 숫자거나, 법인·상품 접미어뿐이면 지점이 아니다.
        """
        rest = cls._bare_tok(tok)
        i = rest.lower().find(brand.lower())
        if i < 0:
            return False
        rest = (rest[:i] + rest[i + len(brand):]).strip()
        if not rest or rest.isdigit():
            return True
        return bool(re.fullmatch("(%s)+" % BRAND_SAFE_SUFFIX, rest, re.I))

    def _label_unknown(self, name: str) -> str:
        if name not in self.map:
            cat = report_category(name)
            self.seq[cat] += 1
            i = self.seq[cat]
            suffix = chr(ord("A") + i - 1) if i <= 26 else str(i)
            self.map[name] = "%s %s" % (cat, suffix)
        return self.map[name]

    def _token(self, tok: str) -> str:
        tok = tok.strip()
        if not tok or is_non_merchant(tok):
            return tok
        if any(re.search(p, tok, re.I) for p in PG_SAFE_PATTERNS):
            return tok      # PG 상호. 가릴 것이 없다
        m = re.search(NATIONAL_BRANDS, tok, re.I)
        if m:
            # 브랜드와 정확히 같으면 그대로 둔다. 뒤에 뭐가 붙어 있으면 지운다.
            # 절단된 상호는 '점' 이 잘려나가 지점 표기로 판별할 수 없으므로
            # 표기 유무로 판단하지 않는다.
            if self._brand_only(tok, m.group(0)):
                return tok
            return m.group(0) + "***"
        # 민감한 것은 '어느 지점' 이지 구조 토큰이 아니다.
        # 영문·숫자 토큰(PG명·구분자)과 일반 명사는 그대로 둔다.
        if tok.isascii() or tok in GENERIC_TOKENS:
            return tok
        # 브랜드 미확인 + 한글 상호 -> 개별 사업장일 수 있다. 카테고리로 바꾼다.
        return self._label_unknown(tok)

    def strict(self, name: str) -> str:
        """빈도표 전용. 브랜드조차 쓰지 않고 카테고리 + 식별자만 남긴다.

        "브랜드 45회" 도 그 자체로 생활 패턴이다. 상위 반복 목록은
        무엇을 얼마나 자주 쓰는지만 보이면 충분하다.
        """
        if is_non_merchant(name):
            return name
        return self._label_unknown(name)

    def label(self, name: str) -> str:
        name = str(name)
        if is_non_merchant(name):
            return name
        parts = re.split("([*_|-])", name)     # 구분자를 살려서 구조를 유지한다
        out = "".join(p if p in "*_|-" else self._token(p) for p in parts)
        # 서로 다른 원문이 같은 라벨을 받으면 "둘이 같은 문자열" 로 읽힌다.
        # 절단으로 갈라진 두 상호를 보여주는 표에서는 그게 결론을 뒤집는다.
        owner = self.taken.get(out)
        if owner is None:
            self.taken[out] = name
            return out
        if owner == name:
            return out
        n = 2
        while True:
            cand = "%s (%d)" % (out, n)
            if self.taken.get(cand) in (None, name):
                self.taken[cand] = name
                return cand
            n += 1


def build_report(norm: Normalizer) -> str:
    dom, ovs = load_rows()
    if not dom and not ovs:
        sys.exit("data/sample.csv 또는 data/overseas_cases.csv 가 필요합니다")

    rows = []
    for r in dom:
        rows.append((r["raw_merchant"], r.get("biz_no", ""),
                     r.get("source_card", "") or "sample.csv", r.get("is_aggregated", "")))
    for r in ovs:
        rows.append((r["raw_merchant"], r.get("biz_no", ""),
                     r.get("source_card", "") or "overseas_cases.csv", ""))

    anon = Anon()
    results = [(src, norm.normalize(m, b)) for m, b, src, _agg in rows]
    agg_rows = [(m, src) for m, b, src, agg in rows if agg]
    teammate = [(m, b) for m, b, src, agg in rows if src == "teammate"]
    n = len(results)
    by_track = Counter(r.track for _, r in results)
    with_biz = by_track["bizno"]

    # 유니크 상호 단위 집계
    uniq: dict[str, Result] = {}
    for _, r in results:
        uniq.setdefault(r.raw, r)

    truncated = sorted({r.raw: r for _, r in results if r.is_truncated}.items())
    overseas = sorted({r.raw: r for _, r in results if r.is_overseas}.items())

    # 축약 충돌: 서로 다른 원문이 같은 문자열 키로 합쳐지는 경우
    collide: dict[str, set] = defaultdict(set)
    for raw, r in uniq.items():
        collide[r.string_norm].add(raw)
    collisions = {k: v for k, v in collide.items() if len(v) > 1}

    # 사업자번호로 묶이지만 문자열 키는 갈라지는 경우 (트랙1이 구해준 케이스)
    biz_group: dict[str, set] = defaultdict(set)
    for _, r in results:
        if r.track == "bizno":
            biz_group[r.norm_key].add(r.raw)
    biz_merged = {k: v for k, v in biz_group.items() if len(v) > 1}

    # 지점명 제거가 min_keep 에 막힌 케이스
    blocked = sorted({r.raw for _, r in results if r.branch_blocked})

    L = []
    a = L.append
    a("# T1 정규화 리포트")
    a("")
    a("`rules/normalize.yaml` 을 실제 카드 내역에 적용한 결과다.")
    a("원본 데이터는 개인 카드 내역이라 커밋하지 않는다. 수치와 상호명만 남긴다.")
    a("")
    a("생성: `python tools/normalize.py --report`")
    a("")
    a("## 1. 트랙별 분포")
    a("")
    a("| 트랙 | 키 | 건수 | 비율 |")
    a("|---|---|---:|---:|")
    for tid, label in (("bizno", "1 · 사업자번호"), ("overseas", "2 · 해외"), ("string", "3 · 문자열")):
        c = by_track.get(tid, 0)
        a("| %s | %s | %d | %.1f%% |" % (
            label,
            {"bizno": "biz_no", "overseas": "overseas_norm", "string": "string_norm"}[tid],
            c, c / n * 100 if n else 0))
    a("| **합계** | | **%d** | |" % n)
    a("")
    a("**사업자번호 커버리지 %.1f%%** (%d/%d건). 나머지 %d건이 문자열·해외 트랙으로 간다."
      % (with_biz / n * 100 if n else 0, with_biz, n, n - with_biz))
    a("")
    a("행 기준 수치다. `data/sample.csv`(국내 %d건) 와 `data/overseas_cases.csv`(%d건) 를 "
      "합쳐 %d건, 유니크 상호 %d개." % (len(dom), len(ovs), n, len(uniq)))
    a("")
    a("## 2. 절단 케이스")
    a("")
    a("EUC-KR %d바이트에 닿아 카드사가 잘라낸 것으로 판정한 상호다. "
      "`strip_branch` 를 적용하지 않는다 — 뒤가 이미 잘려 있어 지점명 제거 규칙이 "
      "엉뚱한 글자를 먹기 때문이다." % int(norm.trunc.get("max_bytes", 20)))
    a("")
    a("상호명은 익명화했다 — 지점명이 생활권을 드러내기 때문이다. "
      "브랜드는 남기고 지점만 `***` 로 지우거나, 브랜드 미확인 상호는 카테고리로 바꿨다.")
    a("바이트 수는 익명화 전 원문에서 계산한 값이다. "
      "같은 라벨에 `(2)` 가 붙은 것은 원문이 서로 다른 별개 상호라는 뜻이다.")
    a("")
    a("| 상호 | 바이트 | 지점명 제거 | 트랙 |")
    a("|---|---:|---|---|")
    for raw, r in truncated:
        a("| `%s` | %d | %s | %s |" % (
            md(anon.label(raw)), r.enc_bytes,
            "생략" if r.branch_skipped else "적용", r.track))
    a("")
    a("총 **%d개 상호**." % len(truncated))
    a("")
    a("### 왜 `>= 20` 이 아니라 `== 20` 인가")
    a("")
    a("`>= 20` 으로 두면 20바이트를 초과하는 정상 입력까지 절단으로 오판해")
    a("지점명 제거가 동작하지 않는다. 카드사가 20에서 자르므로 그보다 긴 문자열은")
    a("애초에 들어오지 않는다.")
    a("")
    a("실제로 첫 구현에서 `>=` 로 뒀다가 `스타벅스코리아 강남대로점`(25바이트)이")
    a("절단으로 판정돼 `스타벅스강남대로점` 이 나왔다. 조건을 바꾸려면 이 케이스를 먼저 볼 것.")
    a("")
    if biz_merged:
        a("### 절단으로 갈라진 문자열이 사업자번호로 다시 묶인 사례")
        a("")
        for k, v in sorted(biz_merged.items()):
            a("- `%s` ← %s" % (mask_bizno(k),
                                " / ".join("`%s`" % md(anon.label(x)) for x in sorted(v))))
        a("")
        a("트랙 1을 최우선에 둔 이유다. 문자열만으로는 같은 회사인지 알 수 없다.")
        a("")
    a("## 3. 축약 충돌 후보")
    a("")
    if collisions:
        a("서로 다른 원문이 같은 문자열 키로 합쳐지는 경우다.")
        a("")
        for k, v in sorted(collisions.items()):
            a("- `%s` ← %s" % (md(anon.label(k)),
                                " / ".join("`%s`" % md(anon.label(x)) for x in sorted(v))))
        a("")
        a("합쳐지는 것이 **맞는** 경우와 **틀린** 경우를 구분해야 한다.")
        a("")
        a("- 같은 브랜드의 다른 지점이 한 키로 모이는 것은 의도한 동작이다. "
          "브랜드 단위 분류(카테고리)를 위한 것이고, 사업자번호가 다르면 트랙 1에서 "
          "여전히 별개로 유지된다.")
        a("- 법인 표기만 다른 같은 회사가 모이는 것도 맞다 "
          "(반복 토큰 접기로 처리된 건).")
        a("- **다른 가맹점이 한 키로 모이는 경우는 현재 목록에 없다.** "
          "새로 생기면 이 표에 나타나므로 여기서 잡는다.")
    else:
        a("현재 샘플에서 **서로 다른 가맹점이 같은 키로 합쳐지는 경우는 없다**.")
    a("")
    if blocked:
        a("### `min_keep` 가드에 막혀 지점명을 제거하지 못한 상호")
        a("")
        a("전부 한글이라 지점 토큰만 떼어낼 수 없는 경우다. "
          "통째로 사라지는 것보다 안 줄이는 쪽이 안전하다고 판단했다.")
        a("")
        for b in blocked:
            a("- `%s` → `%s`" % (md(anon.label(b)), md(anon.label(uniq[b].string_norm))))
        a("")
        a("이 상호들은 전부 사업자번호가 있어 트랙 1로 처리된다. "
          "브랜드 사전(T4)이 생기면 다시 볼 항목이다.")
        a("")
    a("## 4. 해외 결제 판정")
    a("")
    a("판정 기준: 사업자번호 없음 **AND** 영문 글자 비율 %.0f%% 이상."
      % (float(norm.overseas.get("ascii_letter_ratio_min", 0.5)) * 100))
    a("")
    a("| 원문 | 정규화 결과 | 별표 토큰 |")
    a("|---|---|---|")
    for raw, r in overseas:
        a("| `%s` | `%s` | %s |" % (
            md(raw), md(r.norm_key),
            " + ".join("`%s`" % md(t) for t in r.tokens) if r.tokens else "—"))
    a("")
    a("**%d개 상호 / %d건**." % (len(overseas), by_track.get("overseas", 0)))
    a("")
    a("### 같은 서비스인데 키가 갈라지는 경우 — 정상이다")
    a("")
    a("```")
    a("ANTHROPIC* CLA  -> %s" % norm.normalize("ANTHROPIC* CLA").norm_key)
    a("CLAUDE.AI SUBS  -> %s" % norm.normalize("CLAUDE.AI SUBS").norm_key)
    a("```")
    a("")
    a("둘 다 같은 서비스 결제인데 문자열이 전혀 겹치지 않는다. **정규화로 풀 수 없다.**")
    a("문자열을 더 깎아 억지로 붙이면 관계없는 가맹점까지 합쳐진다.")
    a("이건 되묻기 한 번 + 학습 룰카드가 처리할 영역이고, 정규화 단계에서는")
    a("서로 다른 키로 두는 것이 맞다.")
    a("")
    a("`*` 는 양쪽 토큰을 모두 보존한다. 어느 쪽이 결제대행사인지 문자열만으로는")
    a("결정되지 않기 때문이다 — `ANTHROPIC*CLA` 는 앞이 서비스명이고,")
    a("`PYU*Amazon Seller Serv` 는 앞이 PG(PayU)다. 한쪽을 버리는 규칙은 만들지 않았다.")
    a("")
    a("## 5. 예외 목록")
    a("")
    a("축약 과정에서 사라지면 안 되는 토큰이다. 결과에서 없어지면 직전 값으로 되돌린다.")
    a("")
    a("| 토큰 | 근거 |")
    a("|---|---|")
    for exc, why in EXCEPTION_REASONS:
        a("| `%s` | %s |" % (exc, why))
    a("")
    # ── 6. 구분자 분해 ────────────────────────────────────────
    a("## 6. 구분자 분해")
    a("")
    a("`*` 외에 `_` 와 `-` 도 구분자로 쓰인다. 실제 구조는 `서비스명_PG명-법인명` 이다.")
    a("어느 토큰이 PG이고 어느 쪽이 서비스명인지는 문자열만으로 결정되지 않으므로")
    a("(`ANTHROPIC*CLA` 는 앞이 서비스명, `PYU*Amazon` 은 앞이 PG)")
    a("**자르기만 하고 하나도 버리지 않는다.** 판정은 T2 가 한다.")
    a("")
    split_rows = [(src, r) for src, r in results if len(r.tokens) > 1]
    if split_rows:
        seen_split = {}
        for _src, r in split_rows:
            seen_split.setdefault(r.raw, r)
        a("| 원문 | 토큰 | 결과 |")
        a("|---|---|---|")
        for raw, r in sorted(seen_split.items()):
            a("| `%s` | %s | `%s` |" % (
                md(anon.label(raw)),
                " + ".join("`%s`" % md(anon.label(x)) for x in r.tokens),
                md(anon.label(r.string_norm))))
        a("")
        a("총 **%d개 상호**가 2개 이상 토큰으로 분해됐다." % len(seen_split))
        a("")
    collapsed = sorted({r.raw for _s, r in results if r.get("collapsed")})
    if collapsed:
        a("### 반복 토큰을 접은 경우")
        a("")
        a("같은 곳을 두 번 적은 전표다. 접지 않으면 같은 가맹점이 다른 키가 된다.")
        a("")
        for c in collapsed:
            a("- `%s` → `%s`" % (md(anon.label(c)), md(norm.normalize(c).string_norm)))
        a("")

    # ── 7. '-' 오분해 방지 ────────────────────────────────────
    a("## 7. `-` 오분해 방지")
    a("")
    a("`-` 는 상호명 안에도 들어간다. 토큰이 %d개 미만이고 PG 힌트도 없으면 자르지 않는다."
      % int(3))
    a("")
    kept = sorted({r.raw: r for _s, r in results if r.get("cond_kept")}.items())
    if kept:
        a("| 원문 | 판단 | 결과 |")
        a("|---|---|---|")
        for raw, r in kept:
            a("| `%s` | 2토큰 · PG 힌트 없음 → 원문 유지 | `%s` |" % (
                md(anon.label(raw)), md(anon.label(r.string_norm))))
        a("")
        a("총 **%d건**. 자르면 `푸드코트` 같은 조각이 독립 가맹점이 된다." % len(kept))
    else:
        a("현재 데이터에는 해당 케이스가 없다.")
    a("")

    # ── 8. 같은 곳인데 키가 갈라지는 경우 ──────────────────────
    a("## 8. 같은 곳인데 키가 갈라지는 경우")
    a("")
    a("사업자번호가 없는 데이터(팀원 목록)에서는 문자열이 유일한 키다.")
    a("토큰을 공유하는데 최종 키가 다른 묶음을 뽑았다.")
    a("")
    tok_map: dict[str, set] = defaultdict(set)
    for _s, r in results:
        if r.track == "bizno":
            continue
        for tk in (r.tokens or [r.string_norm]):
            if (len(tk) >= 3 and tk not in GENERIC_TOKENS
                    and not re.match(GENERIC_TOKEN_PAT, tk) and not is_non_merchant(tk)):
                tok_map[tk].add(r.string_norm)
    diverged = {k: v for k, v in tok_map.items() if len(v) > 1}
    if diverged:
        for k, v in sorted(diverged.items()):
            a("- 공통 토큰 `%s` → %s" % (md(anon.label(k)),
                                        " / ".join("`%s`" % md(anon.label(x)) for x in sorted(v))))
        a("")
        a("정규화로는 여기까지다. 이 이상 붙이려면 사전(T4)이나 되묻기가 필요하다.")
    else:
        a("현재 데이터에는 해당 케이스가 없다.")
    a("")

    # ── 9. 팀원 데이터 ────────────────────────────────────────
    if teammate:
        a("## 9. 팀원 데이터")
        a("")
        a("가맹점명 한 컬럼짜리 목록이다. 금액·날짜·사업자번호가 없어 **전부 문자열 트랙**이다.")
        a("")
        a("반복 상위 항목은 상호명 대신 카테고리로 적는다. "
          "`같은 편의점 25회` 같은 목록은 거주지·생활권을 드러낸다.")
        a("")
        freq = Counter(m for m, _b in teammate)
        a("| 구분 | 횟수 |")
        a("|---|---:|")
        strict = Anon()
        for m, c in freq.most_common(20):
            a("| %s | %d |" % (md(strict.strict(m)), c))
        a("")
        a("총 %d건 / 유니크 상호 %d개." % (len(teammate), len(freq)))
        a("")
    if agg_rows:
        a("### 합산 건 (`is_aggregated = true`)")
        a("")
        a("카드사가 여러 승인을 하나로 묶어 만든 행이다. 개별 거래가 아니고 가맹점도 "
          "특정되지 않으므로 **제외하지 않고 표시만 한다** — 여비교통 후보다.")
        a("")
        agg_freq = Counter(m for m, _s in agg_rows)
        a("| 항목 | 횟수 |")
        a("|---|---:|")
        for m, c in agg_freq.most_common(12):
            a("| `%s` | %d |" % (md(m), c))
        a("")
        a("총 **%d건**." % len(agg_rows))
        a("")

    a("## 10. 남은 문제")
    a("")
    a("- 사업자번호 없는 %d건은 문자열 키에 의존한다. 절단된 상호가 여기 섞이면"
      " 같은 가맹점이 여러 키로 갈린다." % (n - with_biz))
    a("- `교통-버스1건` 처럼 카드사가 여러 건을 합산해 만든 행은 가맹점이 아니다."
      " 정규화 대상에서 빼야 할지 T2/T3에서 다시 본다.")
    a("- 해외 표본이 %d건뿐이다. 판정 기준(영문 비율)은 표본이 늘면 다시 재야 한다."
      % len(overseas))
    a("")
    return renumber("\n".join(L) + "\n")


# 리포트 익명화 전용 분류. 정식 분류는 T3 의 rules/keyword_rules.yaml 소관이고,
# 여기 것은 "상호명을 그대로 적지 않기 위한" 최소 힌트다.
REPORT_CATEGORY_HINTS = [
    ("편의점", "GS25|지에스25|씨유|CU|세븐일레븐|코리아세븐|이마트24|편의점"),
    ("카페", "커피|카페|CAFE|스타벅스|투썸|이디야|메가|컴포즈|빽다방"),
    ("음식점", "식당|국밥|짬뽕|돈까스|카츠|치킨|피자|버거|리아|한식|분식|스시|초밥|맥주|포차|푸드|"
               "도시락|김밥|낙지|보쌈|찌개|칼국수|막걸리|벤또|국수|후루룩|서브|써브웨이|와플|"
               "베스킨|배스킨|아이스|덮석|하이퍼"),
    ("교통", "교통|버스|지하철|코레일|철도공사|철도|택시"),
    ("의료", "의료_마스킹"),
    ("마트·쇼핑", "마트|다이소|백화점|쇼핑|리테일|유통"),
    ("교육", "학교|대학교|학원|복지단"),
    # 리포트 라벨도 분류 카테고리와 같은 기준으로 묶는다 (세무 판정 기준).
    # 헬스장·노래방을 다른 라벨로 두면 리포트에서 같은 건이 다르게 보인다.
    ("여가", "노래연습장|노래방|코인노래|동전노래|노래|볼링|PC|피씨|당구|게임|짐$|피트니스|헬스"),
    ("미용", "헤어|살롱|미용|바버|네일"),
    ("통신", "아이즈비전|텔레콤|모바일통신|알뜰폰"),
    ("온라인·구독", "구글|플레이|넷플릭스|NETFLIX|쿠팡|배민|요기요|삼성닷컴"),
]

# 지점명이 붙은 상호는 리포트에 지점을 쓰지 않는다.
# 브랜드명 자체는 전국 단위라 개인이 특정되지 않지만, 지점명은 생활권을 드러낸다.
NATIONAL_BRANDS = (
    "GS25|지에스|씨유|CU|세븐일레븐|이마트|롯데|신세계|스타벅스|투썸|이디야|메가|컴포즈|"
    "맘스터치|다이소|코레일|배민|배달의민족|우아한형제들|요기요|쿠팡|구글|넷플릭스|NETFLIX|"
    "삼성|토스|카카오|네이버|다날|섹타나인|KIS|비바리퍼블리카|이랜드|홈플러스|파리바게|뚜레쥬르|"
    "그렙|코페이|아성다이소|현대|SK|GS|한국전력|아웃닭|호식이|생활맥주|엉터리|"
    "요기요|삼성닷컴|카카오선물하기|카카오페이|배민클럽|한국철도공사|아이즈비전|"
    "써브웨이|서브웨이|배스킨라빈스|와플대학|한솥도시락|롯데리아|피자스쿨|컴포즈커피"
)

# 브랜드 뒤에 이것만 붙어 있으면 지점명이 아니다. 그대로 둔다.
# (지점명이 아닌데 지우면 리포트가 "토스***_요기요" 처럼 읽을 수 없게 된다)
BRAND_SAFE_SUFFIX = (
    "페이|페이먼츠|PAY|닷컴|COM|전자|정보통신|통신|유통|리테일|코리아|공사|복지단|비전|"
    "도시락|커피|클럽|선물하기|스토어|스쿨|대학|라빈스|스토리|그룹|홀딩스|서비스|본점|플레이"
)

# PG 이름은 익명화하지 않는다. 결제대행사 상호에는 지점·생활권 정보가 없고,
# 가려버리면 리포트에서 어느 PG 인지 알 수 없어 쓸모가 없어진다.
# rules/pg_blocklist.yaml 이 로드될 때 채워진다.
PG_SAFE_PATTERNS: list = []

# 가맹점이 아닌 행. 카드사가 만든 정산·합산·마스킹 라벨이라 그대로 써도 된다.
NON_MERCHANT = "^(교통|버스|지하철|시외버스|정상할인|포인트사용|의료_?마스킹|.*할인$)"

# 분해 결과에서 흔하게 겹쳐 '같은 곳' 판정을 오염시키는 토큰
GENERIC_TOKEN_PAT = "^(모바일.*|[0-9]+건|.*[0-9]+건)$"
GENERIC_TOKENS = {"모바일", "대표", "청구", "일반", "비인증", "결제", "구매", "주문", "정기",
                  "푸드코트", "매점", "자판기", "본점", "온라인", "선물하기", "클럽", "정보통신",
                  "현장발권", "무한대패", "코인노래연습장"}


def report_category(name: str) -> str:
    for label, pat in REPORT_CATEGORY_HINTS:
        if re.search(pat, name, re.I):
            return label
    return "기타"


def is_national_brand(name: str) -> bool:
    return bool(re.search(NATIONAL_BRANDS, name, re.I))


def is_non_merchant(name: str) -> bool:
    return bool(re.match(NON_MERCHANT, name))


def renumber(text: str) -> str:
    """## N. 제목 의 번호를 등장 순서대로 다시 매긴다.

    팀원 데이터가 없으면 해당 섹션이 빠지는데, 번호가 8 -> 10 으로 튀면
    리포트를 읽는 사람이 빠진 섹션을 찾게 된다.
    """
    out, i = [], 0
    for line in text.splitlines():
        m = re.match("^## [0-9]+[.] (.*)$", line)
        if m:
            i += 1
            out.append("## %d. %s" % (i, m.group(1)))
        else:
            out.append(line)
    return chr(10).join(out) + chr(10)


EXCEPTION_REASONS = [
    ("쿠팡이츠", "쿠팡(온라인쇼핑)과 다른 가맹점. 음식배달로 분류된다"),
    ("이마트24", "이마트(대형마트)와 다른 가맹점. 편의점으로 분류된다"),
    ("GS25", "지에스더프레시·GS칼텍스와 구분. 실측에서 `지에스더프레시(GSTHE` 가 별도 상호로 존재"),
    ("이마트에브리데이", "이마트·이마트24와 각각 다른 업태"),
    ("세븐일레븐", "지점명 제거 규칙이 `일레븐`을 먹지 않도록 보호"),
    ("배민스토어", "배달의민족과 정산 주체가 다르다"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="문자열 하나를 정규화한다")
    ap.add_argument("--biz-no", default="", help="--text 와 함께 쓸 사업자번호")
    ap.add_argument("--selftest", action="store_true", help="normalize.yaml 의 test_cases 실행")
    ap.add_argument("--report", action="store_true", help="docs/normalize_report.md 생성")
    args = ap.parse_args()

    norm = load()

    if args.text:
        r = norm.normalize(args.text, args.biz_no)
        for k in ("raw", "norm_key", "track", "string_norm", "tokens",
                  "branch", "branch_raw",
                  "is_truncated", "is_overseas", "enc_bytes", "branch_skipped", "protected"):
            print("  %-14s %s" % (k, r[k]))
        return 0

    if args.selftest:
        return selftest(norm)

    if args.report:
        REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
        # 어느 경로로 새어나오든 파일에 쓰이기 전에 한 번 더 막는다
        REPORT_MD.write_text(mask_bizno(build_report(norm)), encoding="utf-8")
        print("-> %s" % REPORT_MD)
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
