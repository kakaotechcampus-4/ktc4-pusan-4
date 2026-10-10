# Plaid식 가맹점 매칭 — 대리 평가

결과 문서: [`docs/merchant_matching_eval.md`](../../docs/merchant_matching_eval.md)

| 파일 | 역할 |
|---|---|
| `common.py` | 정규화(normkey 축약판)·20바이트 절단·경로 |
| `build_mapping.py` | 상권 소분류 247종 → 우리 카테고리 → 940909 칸 → `mapping_940909.csv` |
| `mapping_940909.csv` | 매핑표 초안. `★검토` 행은 확인 필요 |
| `run_match.py` | 상권정보 전체 인덱스 + 2만 건 변형 조회 → `data/rows.pkl` |
| `score.py` | 카테고리 정확도, 확정 조건 스윕 |

## 실행
상권정보 원본(공공데이터포털, 시도별 CSV)은 커밋하지 않는다.

```bash
pip install pyyaml
export SANGKWON_DIR=<상권정보 CSV 폴더>
python3 build_mapping.py   # 매핑표를 바꿀 때만
python3 run_match.py       # 약 15초, 메모리 약 1GB
python3 score.py
```
