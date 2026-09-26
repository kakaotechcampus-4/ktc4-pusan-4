"""룰카드에서 카테고리 → 판정 매핑을 뽑는다 (전이율 측정용).

카테고리 오분류가 판정을 뒤집는지 보려면 "이 카테고리면 어떤 판정이 나오는가" 가 필요하다.
룰카드의 match.category 가 그 연결이다. 이 스크립트는 그걸 표로 뽑기만 하고 해석하지 않는다.

    python3 tools/exp_category_cls/extract_category_verdict.py            # 표 출력
    python3 tools/exp_category_cls/extract_category_verdict.py --csv out.csv

주의
- 판정이 카테고리만으로 정해지지 않는 카드가 있다. match 에 amount_min/max·keyword 가 붙은 카드는
  같은 카테고리라도 금액·키워드에 따라 다른 카드가 걸린다. 그런 카테고리는 "조건부" 로 표시한다.
- verdict 가 없고 question 이 있는 카드는 Q(되묻기)로 표시한다.
- match.industry 는 Context 필터라 페르소나가 고정되면 상수다. 조건부 판단에서 제외한다.
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
from collections import defaultdict

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONTEXT_KEYS = {"category", "industry"}


def load_categories() -> list[str]:
    text = open(os.path.join(ROOT, "rules", "categories.yaml"), encoding="utf-8").read()
    return re.findall(r"^\s*-\s*([^\s#:]+)", text, re.M)


def load_cards() -> list[dict]:
    cards = []
    for path in sorted(glob.glob(os.path.join(ROOT, "rules", "cards", "*.yaml"))):
        with open(path, encoding="utf-8") as f:
            cards.append(yaml.safe_load(f))
    return cards


def outcome(card: dict) -> str:
    if card.get("verdict"):
        return str(card["verdict"])
    return "Q" if card.get("question") else "-"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="결과를 CSV 로 저장할 경로")
    args = ap.parse_args()

    cats = load_categories()
    cards = load_cards()
    by_cat: dict[str, list[tuple[str, str, list[str]]]] = defaultdict(list)
    no_category = []
    for c in cards:
        match = c.get("match") or {}
        targets = match.get("category") or []
        if not targets:
            no_category.append(c["id"])
        extra = sorted(k for k in match if k not in CONTEXT_KEYS)
        for cat in targets:
            by_cat[cat].append((c["id"], outcome(c), extra))

    rows = []
    for cat in cats:
        entries = by_cat.get(cat, [])
        outcomes = sorted({o for _, o, _ in entries})
        conditional = any(extra for _, _, extra in entries)
        rows.append({
            "category": cat,
            "cards": " | ".join(f"{i}:{o}" + (f"[{','.join(e)}]" if e else "") for i, o, e in entries),
            "outcomes": ",".join(outcomes) if outcomes else "(카드 없음)",
            "conditional": "조건부" if conditional else "",
        })

    print(f"카드 {len(cards)}장 중 match.category 가 있는 카드 {len(cards) - len(no_category)}장")
    print(f"카테고리 {len(cats)}종 중 카드가 연결된 카테고리 "
          f"{sum(1 for r in rows if r['cards'])}종, 조건부 {sum(1 for r in rows if r['conditional'])}종")
    print(f"카테고리 없는 카드: {', '.join(no_category)}")
    print()
    print("| 카테고리 | 판정 | 조건부 | 카드 |")
    print("|---|---|---|---|")
    for r in rows:
        print(f"| {r['category']} | {r['outcomes']} | {r['conditional']} | {r['cards']} |")

    if args.csv:
        with open(args.csv, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)


if __name__ == "__main__":
    main()
