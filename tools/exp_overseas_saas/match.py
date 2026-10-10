"""해외 결제 문자열 → 카테고리 (해외SaaS / 구독서비스 / 게임 / PG_미상 / 미분류).

1. 은행 문구·결제대행 접두어를 떼고 브랜드 부분을 찾는다
2. 사전(dict.csv) 조회: 도메인형(NAME.COM) 은 강한 증거, 토큰형은 흔한 영단어면 '브랜드 첫 토큰'일 때만 인정
3. 못 찾으면: 결제대행·앱스토어만 보이면 PG_미상, 아니면 미분류
   (api.md 2.4 — 미분류는 분류 확인으로 가서 사용자가 후보 중 카테고리를 고른다.
    구독서비스로 넘겨짚으면 게임·개인 결제가 엉뚱한 질문을 받는다)
"""
import csv, json, re, sys, collections
from pathlib import Path
from wordfreq import zipf_frequency

HERE = Path(__file__).resolve().parent
DICT = {}
for r in csv.DictReader(open(HERE / "dict.csv", encoding="utf-8")):
    DICT[r["alias"]] = (r["category"], r["name"])
UMBRELLA = {"GOOGLE", "MICROSOFT", "MSFT", "AMAZON", "APPLE", "META", "FACEBOOK", "YAHOO", "PAYPAL", "STRIPE"}
PROCESSOR = [r"PADDLE\.NET", r"PAYPAL(\s+INST\s+XFER)?", r"FASTSPRING", r"FS", r"FSPRG\.COM", r"2CO\.COM", r"STRIPE",
             r"SQ", r"SP", r"PYU", r"ADY", r"XSOLLA", r"DNH", r"GOOGLE\s+PLAY(\s+AP)?", r"GOOGLE", r"APPLE\.COM/BILL",
             r"ITUNES\.COM/BILL", r"G\.CO/(HELP|PAY)\w*#?", r"구글플레이", r"구글페이먼트코리아"]
PROC_RE = re.compile(r"^(?:" + "|".join(PROCESSOR) + r")\b[\s,*\-]*", re.I)
BANK = re.compile(r"^(DEBIT CARD PURCHASE - |CREDIT FROM |VISIT )", re.I)
TLD = r"\.(?:COM|NET|IO|APP|SO|US|AI|DEV|CO|ORG|TV)\b"

def generic(a):
    return zipf_frequency(a.lower(), "en") >= 3.5

def lookup(alias):
    if alias in UMBRELLA: return None
    return DICT.get(alias)

def classify(desc):
    s = BANK.sub("", desc.strip()).upper()
    had_proc = False
    parts = [p for p in re.split(r"\*", s) if p.strip()] or [s]
    # 접두어 제거: 맨 앞이 결제대행이면 떼고 기록
    brand_parts = []
    for i, p in enumerate(parts):
        q = p.strip(" ,-")
        while True:
            m = PROC_RE.match(q)
            if not m or m.end() == 0: break
            had_proc = True; q = q[m.end():].strip(" ,-")
        if q: brand_parts.append(q)
    for q in brand_parts:
        # 도메인형
        for dm in re.finditer(r"([A-Z0-9\-]+)" + TLD, q):
            hit = lookup(re.sub(r"[^0-9A-Z]", "", dm.group(1)))
            if hit: return hit[0], "domain:" + dm.group(1), had_proc
        toks = re.findall(r"[A-Z0-9]+", q)
        # 연속 토큰 결합(최대 3) — 첫 토큰부터 우선
        for i in range(len(toks)):
            for k in (3, 2, 1):
                if i + k > len(toks): continue
                a = "".join(toks[i:i + k])
                if len(a) < 3: continue
                hit = lookup(a)
                if not hit: continue
                if k == 1 and generic(a) and i != 0: continue
                return hit[0], "token:" + a, had_proc
    if had_proc or re.search(r"구글플레이|APPLE\.COM/BILL|ITUNES", desc, re.I):
        return "PG_미상", "processor-only", had_proc
    return "미분류", "unknown", had_proc

if __name__ == "__main__":
    ev = json.load(open(HERE / "eval_set.json", encoding="utf-8"))
    res = []
    for e in ev:
        pred, why, _ = classify(e["descriptor"])
        res.append((e, pred, why))
    n = len(res); ok = sum(p == e["label"] for e, p, _ in res)
    print(f"전체 {ok}/{n} = {ok/n:.1%}")
    for st in ("해외조회사이트", "국내카드실증"):
        r = [x for x in res if x[0]["set"] == st]; print(f"  {st}: {sum(p == e['label'] for e, p, _ in r)}/{len(r)}")
    cm = collections.Counter((e["label"], p) for e, p, _ in res)
    print("정답 -> 예측"); [print(f"  {a} -> {b}: {c}") for (a, b), c in sorted(cm.items())]
    tool = [x for x in res if x[0]["label"] == "해외SaaS"]
    print(f"도구 재현율 {sum(p == '해외SaaS' for _, p, _ in tool)}/{len(tool)}")
    over = [x for x in res if x[1] == "해외SaaS" and x[0]["label"] != "해외SaaS"]
    print(f"과대계상(도구 아닌데 해외SaaS) {len(over)}건")
    print("\n오답 목록")
    for e, p, why in res:
        if p != e["label"]: print(f"  [{e['label']}→{p}] {e['descriptor']}  ({why})")
