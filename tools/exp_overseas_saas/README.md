# 해외 결제 카테고리 분류 — 도구 사전 매칭

결과 문서: [`docs/overseas_saas_eval.md`](../../docs/overseas_saas_eval.md)

| 파일 | 역할 |
|---|---|
| `build_dict.py` | 원본 2종 + 키워드룰 시드 → `dict.csv` |
| `dict.csv` | 사전 748개(alias → 카테고리). `source` 칸이 출처 표기 |
| `match.py` | 결제 문구 → 대행사 접두어 제거 → 사전 조회 → 못 찾으면 PG_미상·미분류(사용자 분류) |
| `score_pipeline.py` | `rules/keyword_rules.yaml` 다음에 사전을 거는 전체 흐름으로 채점 |
| `eval_set.json` | 평가 94건(해외 명세서 조회 사이트 실제 표기 87 + 국내 카드 실증 7). 사전과 출처가 다르다 |

## 실행
원본은 커밋하지 않는다. `raw/`(또는 `RAW_DIR`)에 두 파일을 받아 둔다.

```bash
pip install pyyaml wordfreq
python3 build_dict.py      # 사전을 다시 만들 때만
python3 match.py           # 사전만 채점
python3 score_pipeline.py  # 키워드룰 + 사전 채점
```

## 데이터 출처와 라이선스
- **ComparEdge** — [comparedge/awesome-saas-comparison-data](https://github.com/comparedge/awesome-saas-comparison-data), CC BY 4.0 (© ComparEdge, https://comparedge.com). `comparedge_products.json` 에서 이름·URL·카테고리만 뽑고, 크립토·VPN 카테고리를 뺐다.
- **CompanyEnrich** — [Company-Enrich/datasets](https://github.com/Company-Enrich/datasets) `500-saas-companies.csv` → `companyenrich_500.csv`, MIT. b2b 이고 미디어·출판 계열이 아닌 것만.
- free-for.dev 는 라이선스 표기가 없어 넣지 않았다(넣어도 흐름 전체 재현율은 같았다).
