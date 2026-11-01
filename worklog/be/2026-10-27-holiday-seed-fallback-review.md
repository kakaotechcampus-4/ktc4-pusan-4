# holiday-seed-fallback(#163) 리뷰 반영: 키 없이 로컬 실행하면 공휴일 표가 빈다는 안내

- 브랜치: feature/holiday-seed-fallback
- 커밋: 문서 1개
- 주요파일: backend/README.md

## 한 일

- `backend/README.md` "로컬 실행" 절에 한 문단을 더했다. `HOLIDAY_API_KEY` 없이 띄우면 동기화를 건너뛰고 시드도 넣지 않아 새 DB 의 `public_holiday` 가 비고, 공휴일 거래가 평일로 판정된다. 공휴일 판정을 보거나 데모 데이터를 만들 땐 Decoding 키를 넣고 띄우라고 적었다.

## 왜 이렇게 했나

- 리뷰 의견이다. 키가 없을 때 시드를 넣지 않는 동작은 리뷰어도 동의해 코드는 그대로 두고, 로컬에서 헷갈릴 수 있는 부분만 안내했다.

## 확인한 것

- 문서만 바꿨다. 이 브랜치는 develop 과 git 충돌이 없고, develop 과 합쳐 `compileJava compileTestJava` 가 통과하는 것을 2026-10-27 에 확인했다.
