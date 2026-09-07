# 기여 가이드

부산대 4팀 협업 규칙입니다.

## 브랜치 전략

| 브랜치 | 용도 |
|---|---|
| `main` | 멘토님 리뷰 대상. `develop` 에서만 PR 을 받습니다. |
| `develop` | 기본 브랜치. 팀 작업이 모이는 곳. |
| `feature/*` | 기능 작업. `develop` 에서 따고 `develop` 으로 머지. |
| `refactor/*` | 멘토님 리뷰사항 반영하는 브랜치. |

<!-- TODO: hotfix / release 브랜치를 쓸지, 브랜치 이름 규칙(feature/이슈번호-설명 등)을 정할지 -->

## 커밋 메시지

```
<type>: <subject>
```

**예시**

```
feat: G6 한도 버킷 판정 추가
fix: 카드사 CSV 헤더 공백 처리
docs: 커밋 컨벤션 추가
```

### type

| 타입 | 설명 |
| :--- | :--- |
| feat | 새로운 기능 추가 |
| fix | 버그 수정 |
| docs | 문서 수정 |
| style | 코드 포맷팅, 세미콜론 누락, 코드 변경이 없는 경우 |
| refactor | 코드 리팩토링 |
| test | 테스트 코드, 리팩토링 테스트 코드 추가 |
| chore | 빌드 업무 수정, 패키지 |
| design | CSS 등 사용자가 UI 디자인을 변경했을 때 |
| rename | 파일명(or 폴더명)을 수정한 경우 |
| remove | 코드(파일)의 삭제가 있을 때 |
| add | 코드나 테스트, 예제, 문서 등의 추가 생성이 있는 경우 |
| improve | 향상이 있는 경우 (호환성, 검증 기능, 접근성 등) |
| move | 코드의 이동이 있는 경우 |


### subject

- 한국어로 씁니다.
- 문장을 명사로 마칩니다. 끝에 마침표를 찍지 않습니다.
- 50자 이내를 권장합니다.


## PR

- 템플릿([`.github/pull_request_template.md`](.github/pull_request_template.md))을 채웁니다.
