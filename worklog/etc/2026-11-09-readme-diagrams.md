# README 도식 · Langfuse 모니터링 추가, 목차 줄바꿈 수정

- 브랜치: feature/readme-reorder
- 커밋: a4ddb00a (1개)
- 주요파일: README.md, docs/img/readme/rag.png, docs/img/readme/corpus-sync.png, docs/img/readme/langfuse.gif

## 한 일

- 「RAG · 코퍼스 동기화」의 도식화 자리를 `### RAG` · `### 코퍼스 동기화` 소제목과 다이어그램 이미지로 교체하고, 각 아래에 한 줄 설명을 인용으로 붙임. `✏️ 작성 필요` 자리는 삭제
- 「모니터링 (CloudWatch)」을 「모니터링」으로 바꾸고 하위에 `#### CloudWatch`(도식화 자리 유지)와 `#### Langfuse (AI 에이전트 모니터링)`(langfuse.gif)를 둠
- 목차 오른쪽 제목 「🤝 팀이 개발한 방법」의 띄어쓰기를 `&nbsp;` 로 바꿈

## 왜 이렇게 했나

- GitHub 표는 `width: max-content` 라 칸이 내용 폭에 맞춰 줄어든다. 오른쪽 칸 폭이 제목 길이와 거의 같아 폰트에 따라 「방법」이 다음 줄로 넘어갔다. `td width="50%"` 로는 표 전체가 넓어지지 않아서, 줄바꿈 없는 공백으로 칸이 제목 폭만큼 넓어지게 했다

## 남은 것 · 아는 문제

- CI/CD · Redis · Blue/Green · CloudWatch 도식화 자리는 아직 비어 있음
- langfuse.gif 가 2.2MB 로 다른 GIF(0.2~0.4MB)보다 큼
