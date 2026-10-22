# PoC 발표용 데모 브랜치를 리뷰 전 PR까지 합쳐 만든다

- 브랜치: demo/poc-gcp (develop 으로 머지하지 않는다)
- 커밋: c6363ff..6c42917 (first-parent 9개)
- 주요파일: ApiResponseContractTest.java, TransactionRecordEntity.java, UploadBatchEntity.java, BackendApplicationIntegrationTest.java

## 한 일

- origin/develop(5bbaa93)에서 시작해 스택 끝 브랜치만 `--no-ff` 로 합쳤다.
  1. feature/judgment-override (#127 #128 #132 #133 #134 #135 #157)
  2. feature/classification-responses (#130 #156 #158)
  3. feature/transactions-api (#147 #148 최신 head)
  4. feature/holiday-seed-fallback (#163)
  5. feature/statute-history-backfill (#153)
  6. feature/fixed-jwt-auth (#154 #155)
  7. #152 는 고유 커밋 335ab9d·61309cb 만 cherry-pick
  8. design/kakao-ir (#151)
- 충돌 해결
  - 트랙 A × develop(#129): `TransactionRecordEntity`·`UploadBatchEntity`·`UploadBatchRepository` 는 develop 의 public 접근자를 두고 A 의 `judgeable()`·`toJudged()` 를 더했다.
  - 트랙 B × A: `MockFixtures` 는 양쪽이 각자 지운 목 ID(REVIEW_ID, OVERRIDE_*)를 모두 뺐다. 참조가 없다. `ApiResponseContractTest` 는 양쪽 서비스 stub 을 모두 살렸다.
  - 인증(#155): 계약 테스트 `@Import` 를 `TestAuthentication` 으로 바꾸고, 통합 테스트 5개의 `TemporaryCurrentUserProvider.TEMPORARY_USER_ID` 를 `FixedUser.ID` 로 바꿨다.
- 확인: `gradlew -p backend check` 단위 362·통합 153 통과, frontend build·vitest 158·check:tokens 통과, ai pytest 205·ruff 통과.

## 왜 이렇게 했나

- 10/18 의 로컬 `demo/poc-rehearsal-2` 이후 develop 이 6개 PR 앞서갔고 #147·#148·#155 head 가 바뀌어서, 옛 브랜치를 고치지 않고 develop 최신에서 다시 합쳤다.
- #152 는 리뷰 반영 전의 feature/auth-admin(#142) 위에 있어 그대로 합치면 FE 11개 파일이 충돌한다. #142 는 이미 develop 에 들어갔으므로 #152 만의 변경만 가져왔다.

## 남은 것 · 아는 문제

- 각 원 PR 은 그대로다. 이 브랜치의 충돌 해결은 PR 들이 develop 에 머지될 때 다시 해야 한다(계획 문서 "머지할 때 주의할 점").
- GCP(ktc4-pusan-4) 데모 인스턴스에 배포한다. 운영 AWS 와 별개이며 발표 뒤 정리한다.
