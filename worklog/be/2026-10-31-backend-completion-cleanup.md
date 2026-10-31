# 백엔드 완료 기준에 맞춰 문서를 정리한다

- 브랜치: docs/backend-completion-cleanup
- 주요파일: docs/architecture.md, docs/backend_api_plan.md, docs/deployment.md, backend/README.md

## 한 일

- `docs/architecture.md` "구현 범위"를 10월 계획의 기본 흐름 기준으로 다시 썼다. 예전 내용은 판정 엔진·영속성·REST 계층을 "미착수"로 적고 있었다.
- 계획 문서의 "저장소 결정"을 `docs/architecture.md` 로 옮겼다(계획 "문서 정리" 항목). 이후에 생긴 Redis 사용처(메일 인증, 비서 한도)와 여러 탭 재발급을 프론트 `navigator.locks` 로 묶기로 한 결정(#178)도 같이 적었다.
- `docs/deployment.md` 머리말의 "주요 API 는 501" 과 `backend/README.md` 의 "단위 테스트가 없어 NO-SOURCE" 를 지금 상태로 고쳤다.

## 왜 이렇게 했나

- 계획 문서의 완료 기준·문서 정리 항목이 이 네 곳을 가리킨다. 기능 PR 들은 각자 자기 절만 고쳐서 머리말·구현 범위가 남아 있었다.

## 남은 것 · 아는 문제

- 구현 범위와 배포 문서 머리말은 #184(금액·일괄 응답)·인증 스택(#178·#177·#176·#193)·#209(분류 모델) 이 들어간 상태를 적었다. 그 PR 들 뒤에 머지한다.
- `MockResponse`·`MockFixtures` 삭제(완료 기준 1)는 #184 와 인증 스택이 들어가 마지막 `@MockResponse` 와 `FixedUser` 가 빠진 뒤 이 PR 에 더한다.
