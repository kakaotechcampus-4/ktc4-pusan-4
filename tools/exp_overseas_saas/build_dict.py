"""해외 서비스 사전(dict.csv) 만들기.

해외SaaS: ComparEdge(CC BY 4.0) + CompanyEnrich 500(MIT)
구독서비스·게임: rules/keyword_rules.yaml 의 해당 룰만(소수 시드)
그 밖의 해외 결제는 사전에 넣지 않는다 → match.py 가 기본값 구독서비스(되묻기)로 보낸다.
출력 dict.csv: alias, name, category, source  (source 가 출처 표기다)

원본은 커밋하지 않는다. RAW_DIR(기본 ./raw)에 README 의 두 파일을 받아 둔다.
"""
import csv, json, os, re, collections, yaml
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
RAW = Path(os.environ.get("RAW_DIR", HERE / "raw"))
KEYWORD_RULES = HERE.parents[1] / "rules" / "keyword_rules.yaml"


def norm(s):  # 영숫자만, 대문자
    return re.sub(r"[^0-9A-Z]", "", (s or "").upper())


def domain_root(url):
    h = urlparse(url if "//" in (url or "") else "http://" + (url or "")).netloc.lower()
    h = re.sub(r"^(www|app|go|get|try)\.", "", h)
    parts = h.split(".")
    return parts[0] if parts and parts[0] else ""


rows = []


def add(name, url, cat, src):
    n = norm(name)
    if len(n) >= 3:
        rows.append((n, name, cat, src))
    d = norm(domain_root(url))
    if len(d) >= 3 and d != n:
        rows.append((d, name, cat, src))


# 1) ComparEdge — 크립토는 도구가 아니라 제외, VPN 은 개인 용도가 섞여 제외
EXCL = ("crypto", "dex", "defi", "vpn")
for p in json.load(open(RAW / "comparedge_products.json", encoding="utf-8")):
    if p.get("category", "").startswith(EXCL):
        continue
    add(p["name"], p.get("url"), "해외SaaS", "comparedge:" + p["category"])

# 2) CompanyEnrich — b2b 이고 미디어·출판 계열이 아닌 것만
MEDIA = {"media", "digital media", "publishing", "digital publishing", "music", "photography",
         "online reviews", "nonprofit", "non-profit"}
for r in csv.DictReader(open(RAW / "companyenrich_500.csv", encoding="utf-8")):
    if "b2b" in (r.get("Type") or "") and (r.get("Category") or "").strip().lower() not in MEDIA:
        add(r["Name"], r.get("URL"), "해외SaaS", "companyenrich:" + (r.get("Category") or ""))

# 3) keyword_rules — 구독서비스·게임 (소수 시드)
for r in yaml.safe_load(open(KEYWORD_RULES, encoding="utf-8"))["rules"]:
    if r.get("category") in ("구독서비스", "게임"):
        for alt in r["match"].split("|"):
            alt = re.sub(r"\\s\*|\\b|\\.|\?|\(|\)|\\", "", alt)
            if re.fullmatch(r"[A-Za-z0-9 ]+", alt):
                add(alt, "", r["category"], "keyword_rules")

# 같은 alias 가 여러 카테고리면 사전에서 뺀다(모호)
by = collections.defaultdict(set)
for a, n, c, s in rows:
    by[a].add(c)
seen, out = set(), []
for a, n, c, s in rows:
    if len(by[a]) > 1 or a in seen:
        continue
    seen.add(a)
    out.append((a, n, c, s))
with open(HERE / "dict.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["alias", "name", "category", "source"])
    w.writerows(out)
print(len(out), collections.Counter(c for _, _, c, _ in out),
      collections.Counter(s.split(":")[0] for *_, s in out))
