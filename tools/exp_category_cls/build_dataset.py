"""상권정보 CSV -> 실험용 라벨 데이터셋.

카드 문자열을 흉내내기 위해 상호명+지점명을 붙인 문자열을 만든다.
label = 상권업종중분류명, group = 상호명(브랜드)
"""
import sys, glob, os, pandas as pd

SRC = os.path.expanduser("~/mnt/kakaoTechCampus/second_course/소상공인시장진흥공단_상가(상권)정보_20260630")
OUT = os.path.expanduser("~/mnt/kakaoTechCampus/second_course/실험_카테고리분류비교/data/dataset.csv")
COLS = ["상호명", "지점명", "상권업종중분류명", "상권업종소분류명", "시도명"]

def main(start, end):
    files = sorted(glob.glob(os.path.join(SRC, "*.csv")))[start:end]
    header = not os.path.exists(OUT)
    for f in files:
        rows = 0
        for ch in pd.read_csv(f, usecols=COLS, dtype=str, chunksize=200_000):
            ch = ch.dropna(subset=["상호명", "상권업종중분류명"])
            ch["상호명"] = ch["상호명"].str.strip()
            ch["지점명"] = ch["지점명"].fillna("").str.strip()
            ch = ch[ch["상호명"].str.len() >= 2]
            ch.to_csv(OUT, mode="a", header=header, index=False)
            header = False
            rows += len(ch)
        print(os.path.basename(f), rows, flush=True)

if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]))
