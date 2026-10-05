"""가맹점 매칭 실험 — 공통.

상권정보 원본 위치는 SANGKWON_DIR 환경변수(기본: 이 폴더의 data/sangkwon).
normkey 는 T1 정규화의 축약판이다(공백·기호 제거 + 대문자 + 지점 접미어 절단).
"""
import os, re, unicodedata
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SANGKWON_DIR = os.environ.get("SANGKWON_DIR", os.path.join(HERE, "data", "sangkwon"))
OUT_DIR = os.path.join(HERE, "data")
MAPPING = os.path.join(HERE, "mapping_940909.csv")

SUFFIX = re.compile(r"(본점|직영점|가맹점|[가-힣A-Z0-9]{1,10}점)$")
NONWORD = re.compile(r"[^0-9A-Z가-힣]")


def normkey(s: str) -> str:
    s = unicodedata.normalize("NFC", s or "").upper()
    s = NONWORD.sub("", s)
    for _ in range(2):
        m = SUFFIX.search(s)
        if not m or m.start() == 0:
            break
        s = s[:m.start()]
    return s


def trunc20(s: str):
    """카드 이용내역의 가맹점명은 EUC-KR 20바이트에서 잘린다."""
    b = s.encode("euc-kr", "replace")
    if len(b) <= 20:
        return s, False
    return b[:20].decode("euc-kr", "ignore"), True


def keyword_patterns():
    with open(os.path.join(ROOT, "rules", "keyword_rules.yaml"), encoding="utf-8") as f:
        return [re.compile(r["match"], re.I) for r in yaml.safe_load(f)["rules"]]


def sangkwon_files():
    return sorted(os.path.join(SANGKWON_DIR, f) for f in os.listdir(SANGKWON_DIR) if f.lower().endswith(".csv"))
