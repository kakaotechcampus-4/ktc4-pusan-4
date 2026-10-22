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

## 14:10 웹 이미지가 목업 모드로 빌드되던 것을 고친다

- `deploy/web.Dockerfile` 에 `ARG VITE_API` 를 추가했다. 기본값이 비어 있어 기존(목업) 빌드는 그대로이고, 데모 배포는 `--build-arg VITE_API=http` 로 빌드한다.
- 첫 배포는 이 인자 없이 빌드해서 프런트가 서버를 부르지 않았다. 업로드 결과가 서버 DB 에 0건이었고, 번들에 `/api/v1` 참조가 없었다. 운영 AWS 도 같은 Dockerfile 이라 목업으로 돈다(`docs/deployment.md` 1절에 적힌 대로).
- 이미지는 Windows worktree 대신 LF 로 받은 checkout 에서 다시 빌드한다. 컨테이너의 `rules/*.yaml` 이 CRLF 로 들어가 레포와 md5 가 달랐다.

## 15:20 발표에서 여러 사람이 각자 쓰도록 이메일 자유 가입을 붙인다

- 로그인은 고정 사용자 하나(`demo@example.com`)만 받았다. 모두 같은 사용자라, 두 번째 사람부터 같은 파일 업로드가 409(`DUPLICATE_FILE`)로 막히고, 개인 사전·답변·탈퇴가 서로에게 번졌다.
- `FixedUserCredentialVerifier` 가 공용 비밀번호만 확인하고, 이메일은 `UserService.findOrCreateByEmail` 로 찾거나 만든다. 이메일은 소문자로 저장하고, `insert … on conflict (email) do nothing` 뒤 다시 읽어 동시 첫 로그인에도 한 행만 남는다.
- 로그인 화면(실서버 모드)에 비밀번호와 "실제 이메일은 쓰지 마세요" 안내를 넣었다.
- 업로드 중복 검사(파일 해시, 거래 natural_key)를 푸는 쪽은 택하지 않았다. 같은 사용자 안에서 거래가 여러 벌 생겨 연도 합산이 부풀고, 개인 사전 공유 문제는 남는다.
- 확인: `gradlew -p backend check` 단위 361·통합 155 통과(새 통합 테스트 2개), frontend typecheck·vitest 158 통과.
- 남은 것: 가입 횟수 제한이 없다. 이틀짜리 데모라 감수하고, 발표 뒤 VM 과 함께 지운다. develop 에는 넣지 않는다(실제 인증은 B9b).
