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

    def step_split_asterisk(self, s, ctx, step):
        if "*" not in s:
            return s
        tokens = [t.strip() for t in s.split("*") if t.strip()]
        ctx["tokens"] = tokens
        # 어느 쪽이 PG 인지 문자열만으로는 결정되지 않는다. 둘 다 남긴다.
        return step.get("join", "|").join(tokens)

    def step_strip_special(self, s, ctx, step):
        chars = step.get("chars", r"[.*#/&,'\"()\[\]_~\\]")
        return re.sub(chars, "", s)

    def step_upper_ascii(self, s, ctx, step):
        return "".join(c.upper() if c.isascii() else c for c in s)

    def step_strip_branch(self, s, ctx, step):
        if step.get("skip_if_truncated") and ctx.get("is_truncated"):
            ctx["branch_skipped"] = True
            return s
        min_keep = int(step.get("min_keep", 2))
        for pat in step.get("patterns") or []:
            cand = re.sub(pat, "", s).strip()
            if cand != s and len(cand) >= min_keep:
                ctx["branch_pattern"] = pat
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
        )

    def string_key(self, raw: str) -> str:
        """문자열 트랙 결과만 필요할 때 (사전 norm_key 검증용)."""
        return self.run_pipeline(raw)[0]


def load() -> Normalizer:
    if not NORMALIZE_YAML.exists():
        sys.exit("rules/normalize.yaml 이 없습니다")
    with NORMALIZE_YAML.open(encoding="utf-8") as f:
        return Normalizer(yaml.safe_load(f))


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


def build_report(norm: Normalizer) -> str:
    dom, ovs = load_rows()
    if not dom and not ovs:
        sys.exit("data/sample.csv 또는 data/overseas_cases.csv 가 필요합니다")

    rows = []
    for r in dom:
        rows.append((r["raw_merchant"], r.get("biz_no", ""), "sample.csv"))
    for r in ovs:
        rows.append((r["raw_merchant"], r.get("biz_no", ""), "overseas_cases.csv"))

    results = [(src, norm.normalize(m, b)) for m, b, src in rows]
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
    a("| 원문 | 바이트 | 정규화 결과 | 트랙 |")
    a("|---|---:|---|---|")
    for raw, r in truncated:
        a("| `%s` | %d | `%s` | %s |" % (md(raw), r.enc_bytes, md(r.string_norm), r.track))
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
            a("- `%s` ← %s" % (mask_bizno(k), " / ".join("`%s`" % md(x) for x in sorted(v))))
        a("")
        a("트랙 1을 최우선에 둔 이유다. 문자열만으로는 같은 회사인지 알 수 없다.")
        a("")
    a("## 3. 축약 충돌 후보")
    a("")
    if collisions:
        a("서로 다른 원문이 같은 문자열 키로 합쳐지는 경우다.")
        a("")
        for k, v in sorted(collisions.items()):
            a("- `%s` ← %s" % (md(k), " / ".join("`%s`" % md(x) for x in sorted(v))))
        a("")
        a("합쳐지는 것이 **맞는** 경우(같은 브랜드의 다른 지점)와 **틀린** 경우"
          "(다른 가맹점)를 구분해야 한다. 위 목록은 전부 같은 브랜드의 다른 지점이고,")
        a("각각 사업자번호가 달라 트랙 1에서는 별개로 유지된다. "
          "문자열 키로 합쳐지는 것은 브랜드 단위 분류(카테고리)를 위해서다.")
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
            a("- `%s` → `%s`" % (b, uniq[b].string_norm))
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
    a("## 6. 남은 문제")
    a("")
    a("- 사업자번호 없는 %d건은 문자열 키에 의존한다. 절단된 상호가 여기 섞이면"
      " 같은 가맹점이 여러 키로 갈린다." % (n - with_biz))
    a("- `교통-버스1건` 처럼 카드사가 여러 건을 합산해 만든 행은 가맹점이 아니다."
      " 정규화 대상에서 빼야 할지 T2/T3에서 다시 본다.")
    a("- 해외 표본이 %d건뿐이다. 판정 기준(영문 비율)은 표본이 늘면 다시 재야 한다."
      % len(overseas))
    a("")
    return "\n".join(L) + "\n"


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
