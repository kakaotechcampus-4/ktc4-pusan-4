# 카테고리 분류 방식 비교 실험

결과 문서: [`docs/category_classifier_vs_embedding.md`](../../docs/category_classifier_vs_embedding.md)

## 파일

| 파일 | 역할 |
|---|---|
| `build_dataset.py` | 상권정보 원본 CSV → `data/dataset.csv` |
| `common.py` | 데이터 적재, 브랜드 단위 분리, 정밀도-자동화율 계산 |
| `run.py` | 방식 A·B1·B2(+ B3) 비교 |
| `run_residual.py` | 키워드룰이 못 거른 잔여분에서만 비교 |
| `embed_elice.py` | 엘리스 임베딩 API 호출 → `emb_*.npz` (B3 재료) |

데이터(`data/`), 임베딩 캐시(`emb_cache.jsonl`), 결과 `.npz` 는 용량이 커서 커밋하지 않는다.
상권정보 원본은 공공데이터포털에서 받아 `build_dataset.py` 로 만든다.

## 실행

```bash
pip install scikit-learn pandas numpy
python3 run.py                 # 전체 비교
python3 run.py --match-emb     # 외부 임베딩과 학습 표본을 맞춘 공정 비교
python3 run_residual.py        # 잔여분만
```

데이터 경로는 `DATASET=경로` 로 넘길 수 있다.

## 외부 임베딩(B3)

엘리스 모델 라이브러리에서 `Text Embedding 3 Small` 엔드포인트와 키를 발급받아 환경변수로 넘긴다.
키는 절대 커밋하지 않는다 (이 repo 는 public).

```bash
export ELICE_BASE_URL="https://mlapi.run/<엔드포인트ID>/v1"
export ELICE_API_KEY="<키>"
python3 embed_elice.py          # 견적만
python3 embed_elice.py --run    # 실제 호출
```

`emb_*.npz` 가 폴더에 있으면 `run.py` 가 자동으로 B3 행을 추가한다.
