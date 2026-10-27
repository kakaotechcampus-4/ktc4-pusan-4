# judgments-query 에 develop 을 merge 해 업로드 서비스(B4)와의 충돌을 푼다

- 브랜치: feature/judgments-query
- 커밋: f0b4a74 (merge 1개)
- 주요파일: TransactionRecordEntity.java, UploadBatchEntity.java, UploadBatchRepository.java

## 한 일

- #127·#128 을 develop 에 merge 하고 #132 의 base 를 develop 으로 바꾸기 전에, develop 을 이 브랜치에 merge 했다.
- `UploadBatchEntity`·`UploadBatchRepository`: #127 때(worklog `2026-10-22-judgment-runs-develop-merge`)와 같은 충돌이라 develop 쪽을 그대로 썼다.
- `TransactionRecordEntity`: #129 가 public 생성자와 `id()`·`merchantCategory()` 등 public 접근자를 더했고, 이 브랜치(97e2f53)는 같은 자리에 package-private `id()` 와 `toJudged()` 를 더했다. develop 쪽을 쓰고 `toJudged()` 만 더했다. `id()`·`merchantCategory()` 는 develop 의 public 판이 대신한다.

## 왜 이렇게 했나

- 저장소가 merge 후 브랜치를 지우지 않아 스택 PR 의 base 가 자동으로 develop 으로 바뀌지 않는다. base 를 손으로 바꾸고 이 merge 를 push 해서 CI 가 develop 과 합친 상태로 돌게 했다.

## 확인한 것

- `gradlew -p backend check` 통과(test 332, integrationTest 90).

## 15:40 develop 을 한 번 더 merge 해 GitHub 의 충돌 판정을 푼다

- 커밋: 0d5cce7 (merge 1개)

### 한 일

- base 를 develop 으로 바꾼 뒤 GitHub 가 #132 를 CONFLICTING 으로 보고 CI 도 돌리지 않았다. 로컬 `git merge-tree` 는 충돌이 없었다.
- #127·#128 이 들어간 develop(bfbeba2)을 다시 merge 했다. 코드 변경은 없고 worklog 파일 하나만 들어왔다.

### 왜 이렇게 했나

- develop(afc78e6)과 이 브랜치(f0b4a74)가 각자 develop 을 merge 해서 merge base 가 둘인 criss-cross 상태였다. 로컬 git 은 가상 base 로 합쳐 충돌이 없지만 GitHub 는 하나만 골라 충돌로 본다. develop 을 조상으로 만들면 base 가 하나가 된다.

### 남은 것 · 아는 문제

- #133~#135 도 base 를 develop 으로 바꾸면 같은 일이 생길 수 있다. 그때도 develop 을 merge 해 push 한다.

## 15:40 judgments-summary(#133) 에 develop 을 merge 한다

- 브랜치: feature/judgments-summary
- 커밋: e40bacf (merge 1개)

### 한 일

- #132 를 develop 에 merge(a704c13)하고 #133 의 base 를 develop 으로 바꾼 뒤, develop 을 이 브랜치에 merge 했다. 충돌은 없었다.
- #132 때처럼 merge base 가 둘이 되어 GitHub 가 충돌로 보는 일을 막으려고 미리 merge 했다.

### 확인한 것

- `gradlew -p backend check` 통과(test 334, integrationTest 91).

## 15:48 questions-query(#134) 에 develop 을 merge 한다

- 브랜치: feature/questions-query
- 커밋: 9e9149c (merge 1개)

### 한 일

- #133 을 develop 에 merge(4abf10d)하고 #134 의 base 를 develop 으로 바꾼 뒤, develop 을 이 브랜치에 merge 했다. 충돌은 없었다.

### 확인한 것

- `gradlew -p backend check` 통과(test 339, integrationTest 95).

## 15:59 question-responses(#135) 에 develop 을 merge 한다

- 브랜치: feature/question-responses
- 커밋: 75e432f (merge 1개)

### 한 일

- #134 를 develop 에 merge(4ef480e)하고 #135 의 base 를 develop 으로 바꾼 뒤, develop 을 이 브랜치에 merge 했다. 충돌은 없었다.

### 확인한 것

- `gradlew -p backend check` 통과(test 339, integrationTest 100).

### 남은 것 · 아는 문제

- #157(draft, A5)의 base 는 여전히 feature/question-responses 다. #135 가 merge 되면 develop 으로 바꿔야 한다.

## 16:08 judgment-override(#157) 의 base 를 develop 으로 바꾸고 develop 을 merge 한다

- 브랜치: feature/judgment-override
- 커밋: 7c24ac4 (merge 1개)

### 한 일

- #135 가 develop 에 들어가(808d636) #157 의 base 였던 feature/question-responses 가 끝났다. base 를 develop 으로 바꾸고 develop 을 merge 했다. PR 은 draft 그대로 둔다.
- `TransactionRecordEntity` 가 충돌했다. develop 은 package-private `merchantCategory()` 를 지우고 public 판을 두었고, 이 브랜치(199dfee)는 같은 자리에 `judgeable()` 을 더했다. develop 쪽을 쓰고 `judgeable()` 만 더했다.

### 확인한 것

- `gradlew -p backend check` 통과(test 339, integrationTest 111).
