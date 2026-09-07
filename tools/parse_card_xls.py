#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
카드 이용내역 파서 CLI.

카드사별 읽기 로직은 tools/parsers/ 아래 어댑터에 있다.
이 파일은 입력 수집 -> 어댑터 디스패치 -> 취소 페어링 -> CSV 출력만 한다.

사용:
    python tools/parse_card_xls.py                             # data/*.xls, *.txt 전부
    python tools/parse_card_xls.py data/kb_card_raw.xls --card-type kb
    python tools/parse_card_xls.py -o data/sample.csv

--card-type 을 주면 그 어댑터를 쓰고, 안 주면 매직바이트로 판별한다.
지정값과 판별 결과가 다르면 경고를 띄운다 (IBK·KB 가 같은 .xls 확장자다).

출력: approved_at, raw_merchant, amount, installment_months, approval_no,
      natural_key, biz_no, memo, source_card, is_aggregated, branch, branch_raw,
      needs_review, review_reason

  승인일·승인번호는 출력한다 — 거래 자체의 속성이고 natural_key 의 재료다.
  계속 버리는 것: 카드번호, 이용고객명, 이용카드명.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import parsers  # noqa: E402

try:
    import normalize as nz  # noqa: E402
except Exception:  # noqa: BLE001
    nz = None

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "data" / "sample.csv"


def collect_inputs(args) -> list:
    if args.inputs:
        return [Path(p) for p in args.inputs]
    data = ROOT / "data"
    return sorted(data.glob("*.xls")) + sorted(data.glob("*.txt"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="*", help="카드 내역 파일 (생략 시 data/*.xls, *.txt)")
    ap.add_argument("-o", "--out", default=str(DEFAULT_OUT))
    ap.add_argument("--card-type", choices=parsers.CARD_TYPES,
                    help="카드사 지정. 생략하면 매직바이트로 판별한다")
    args = ap.parse_args()

    paths = collect_inputs(args)
    if not paths:
        sys.exit("입력 파일이 없습니다. data/ 에 카드 내역을 넣어주세요.")

    st = parsers.Stats()
    records, warnings = [], []
    blocked = 0
    for p in paths:
        recs, used, warn = parsers.read_file(p, st, args.card_type)
        if warn:
            warnings.append((p.name, warn))
        print("%s: [%s형] %d행" % (p.name, used.upper(), len(recs)))
        records.extend(recs)

    # 순서가 중요하다. 할인·포인트사용을 먼저 걷어내야 한다 —
    # IBK 가 '취소또는할인' 을 한 칸에 묶어 주기 때문에, 안 걷어내면
    # 할인 17건이 '짝 못 찾은 취소' 로 쌓인다.
    records = parsers.drop_non_transactions(records, st)
    # 취소 행과 그 원 결제를 함께 제외한다 (취소만 빼면 경비가 부풀려진다)
    kept = parsers.pair_cancellations(records, st)
    norm = nz.load() if nz is not None else None
    rows = parsers.to_rows(kept, st, norm)
    # 출력 행과 원본 레코드를 짝지어 natural_key 충돌을 본다.
    # to_rows 가 일부 행을 버리므로 키가 있는 행만 다시 맞춘다.
    parsers.check_natural_keys(
        [r for r in kept if parsers.keeps_row(r)], rows, st)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=parsers.OUT_FIELDS)
        w.writeheader()
        w.writerows(rows)

    report(st, rows, out, warnings)
    return 0


def report(st, rows, out, warnings) -> None:
    if st.statement_kinds:
        print()
        print("  === 승인내역 / 청구내역 판별 ===")
        for name, kind, why in st.statement_kinds:
            mark = "OK  " if kind == "승인내역" else "차단"
            print("  %s %-26s %s  (%s)" % (mark, name, kind, why))
    if warnings:
        print()
        for name, w in warnings:
            print("  ! %s: %s" % (name, w))
    if st.blocked_files:
        print()
        print("  !! 파싱을 거부한 파일 %d개. 위 안내대로 다시 받아주세요." % len(st.blocked_files))

    uniq = len({r["raw_merchant"] for r in rows})
    with_bizno = sum(1 for r in rows if r["biz_no"])
    with_memo = sum(1 for r in rows if r["memo"])
    with_branch = sum(1 for r in rows if r["branch"])
    with_branch_raw = sum(1 for r in rows if r["branch_raw"])
    print()
    print("  === 이 샘플 기준 ===")
    print("  원본 행           %d" % st.total)
    print("  취소 행           %d" % st.cancelled)
    print("    ├ 원 결제 짝지어 제외  %d" % st.paired_originals)
    print("    ├ 취소 대상 불확정     %d  (아무것도 안 지우고 되묻기)" % st.ambiguous_cancels)
    print("    └ 짝 후보 없음        %d" % st.unpaired_cancels)
    print("  비거래 제외       %d" % st.non_transaction)
    print("  외화전용 제외     %d" % st.foreign_ccy)
    print("  금액 없음         %d" % st.no_amount)
    print("  합산 건 표시      %d  (제외하지 않음)" % st.aggregated)
    print("  의료 마스킹       %d개 상호" % len(st.medical_map))
    print("  기록              %d  (유니크 상호 %d)" % (st.kept, uniq))
    for card, n in sorted(st.per_card.items()):
        print("    - %-9s %d건" % (card, n))
    pct = (with_bizno / st.kept * 100) if st.kept else 0
    print("  사업자번호        %d/%d  (%.1f%%)" % (with_bizno, st.kept, pct))
    print("  memo 있음         %d건" % with_memo)
    print("  branch 추출       %d건 / branch_raw(추출 실패) %d건" % (with_branch, with_branch_raw))
    print("  needs_review      %d건" % sum(1 for r in rows if r["needs_review"]))
    print("  approved_at 있음   %d/%d건" % (st.kept - st.no_date, st.kept))
    print("  natural_key 생성   %d/%d건  (날짜 없으면 못 만든다)"
          % (st.kept - st.no_natural_key, st.kept))
    inst = sum(1 for r in rows if str(r["installment_months"]) not in ("0", ""))
    print("  할부 건            %d건 (나머지는 일시불=0)" % inst)
    print("  natural_key 충돌   실제 중복 %d건 / 별개 거래 %d건"
          % (len(st.dup_real), len(st.dup_distinct)))
    print("  폴백 위험 조합     %d개 -> 합산 행 제외 후 %d개"
          % (st.risky_combos_all, st.risky_combos_pairable))
    print("  -> %s" % out)

    if st.dup_real:
        print()
        print("  natural_key 충돌 — 실제 중복 (승인번호 동일. 같은 거래가 두 번):")
        for key, m, amt, dt, n, scope, files, *_ in st.dup_real:
            print("    %s %-22s %-9s %s  %d건 (%s: %s)"
                  % (key, m, amt, dt, n, scope, ", ".join(files)))
        print("    -> 자동 병합하지 않는다. 적재 시 UNIQUE 제약이 막는다")
    if st.dup_distinct:
        print()
        print("  natural_key 충돌 — 별개 거래인데 키가 겹침 (설계 한계):")
        for key, m, amt, dt, n, scope, files, approvals in st.dup_distinct:
            print("    %s %-22s %-9s %s  %d건 승인번호 %s"
                  % (key, m, amt, dt, n, ", ".join(approvals)))
        print("    -> 같은 날 같은 가맹점 같은 금액이 실제로 여러 건인 경우다.")
        print("       natural_key 만으로는 구분 불가. 자동 병합하면 실제 지출이 사라진다.")
    if st.pair_log:
        print()
        print("  취소-원결제 짝지어 제외한 건:")
        for m, amt, how in st.pair_log:
            print("    %-24s %-10s (%s 매칭)" % (m, amt, how))
    if st.ambiguous_log:
        print()
        print("  취소 대상 불확정 (원 결제를 하나도 지우지 않았다):")
        for m, amt, n in st.ambiguous_log:
            print("    %-24s %-10s 후보 %d건 -> 전부 needs_review" % (m, amt, n))
    if st.unpaired_log:
        print()
        print("  짝을 못 찾은 취소 (원 결제를 지우지 않았다):")
        for m, amt, why in st.unpaired_log:
            print("    %-24s %-10s %s" % (m, amt, why))
    if st.non_transaction_samples:
        print()
        print("  비거래 제외 내역:")
        for m, c in st.non_transaction_samples.most_common(6):
            print("    %-16s %d건" % (m, c))
    if st.aggregated_samples:
        print()
        print("  합산 건 (is_aggregated=true) 상위:")
        for m, c in st.aggregated_samples.most_common(6):
            print("    %-20s %d건" % (m, c))

    by_merchant: dict = {}
    for r in rows:
        by_merchant.setdefault(r["raw_merchant"], set()).add(r["memo"])
    split = {m: v for m, v in by_merchant.items() if len([x for x in v if x]) > 1}
    if split:
        print()
        print("  같은 상호 / 다른 memo:")
        for m, v in sorted(split.items()):
            print("    %s -> %s" % (m, ", ".join(sorted(x for x in v if x))))

    print()
    print("  ※ natural_key 는 마스킹 전 원본 상호명으로 계산한다. 재파싱 안정성을")
    print("     위한 것이며, 해시가 원본을 담게 되는 것은 스키마 설계상 모든 행에 공통이다.")
    print("  ※ teammate 189건은 날짜 컬럼이 없어 natural_key 를 만들지 못한다.")
    print("     분석용 데이터이고 제품 경로(카드 파일 업로드)에는 들어가지 않으므로 정상이다.")
    print("  ※ installment 파싱은 실데이터로 검증되지 않았다 — 표본이 전부 일시불이다.")
    print("     할부 거래가 들어오면 재확인할 것.")
    print("  ※ 위 수치는 현재 입력 파일만 기준이다.")
    print("     시드 사전은 이 샘플만으로 채우지 않는다.")


if __name__ == "__main__":
    sys.exit(main())
