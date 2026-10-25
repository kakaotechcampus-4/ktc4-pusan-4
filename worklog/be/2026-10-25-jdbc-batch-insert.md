# insert 를 JDBC 배치로 묶어 보낸다 (order_inserts 는 끈다)

- 브랜치: refactor/jdbc-batch-insert
- 커밋: 7372123 (1개)
- 주요파일: application.yml, InsertOrderIntegrationTest.java

## 한 일

- `application.yml` 에 `hibernate.jdbc.batch_size: 100` 과 Hikari `data-source-properties.reWriteBatchedInserts: true` 를 넣었다
- `InsertOrderIntegrationTest`: 기존 거래의 review → 새 거래 → 새 거래의 review 순서로 한 트랜잭션에서 저장해도 성공하는지 본다. `order_inserts: true` 를 넣으면 `classification_review_transaction_id_fkey` 위반으로 실패하는 것을 확인했다

## 왜 이렇게 했나

- 계기: 멘토 리뷰(#165)의 "3,000건 테스트 때 DB CPU 가 얼마나 스파이크되는지". 백엔드·Postgres 컨테이너에 CPU 1개씩 주고 0.5초 간격으로 cgroup CPU 를 쟀다
  - run 1개: DB CPU 평균 약 40%, 최대 65%. 짧게 튀지 않고 run 내내 유지된다
  - run 2개 동시(운영 워커 2): 평균 65~67%, 최대 95%. CPU 1개 한도에 닿는다
  - 디스크 읽기 12블록, 쿼리 평균 0.3ms 이하라 인덱스 문제는 아니다. 쿼리 실행 시간 합은 DB CPU 의 약 1/3 이다. 나머지는 문장 수·커밋 수에 비례하는 비용으로 본다(나눠 재지 않음)
  - #168 을 적용하면 DB CPU 총 사용이 약 40% 준다
- 배치 설정 효과(#168 코드, 3,000건): 쿼리 42,019 → 38,112, run 생성 POST 874ms → 약 330ms. DB CPU·run 시간은 회차 차이 안이었다. 판정은 거래마다 커밋해 한 트랜잭션에 같은 insert 가 하나뿐이라 묶을 게 없다
- develop 코드에서는 POST 1.5~1.9초 → 1.0~1.1초. item 저장 전에 행마다 SELECT(merge)가 남아 #168 위보다 효과가 작다
- `order_inserts` 를 뺀 이유: 엔티티에 연관관계 매핑이 없어 Hibernate 가 FK 순서를 모른다. 처음 나온 테이블 순서로 묶어 [자식, 자식] → [부모] 로 보낸다. 지금 코드는 이런 순서가 없어 켜도 전체 테스트가 통과했지만, 효과를 본 item `saveAll` 은 한 테이블이라 정렬이 필요 없다
- `order_updates` 도 쓸 이유가 없어 넣지 않았다
- 드라이버 옵션을 DB URL 대신 Hikari `data-source-properties` 로 줘서 운영 compose 의 `SPRING_DATASOURCE_URL` 을 고치지 않았다

## 남은 것 · 아는 문제

- 측정은 개발 PC(Docker Desktop)에서 CPU 를 제한한 값이다. EC2 에서 재지 않았다
- 제약 위반이 `BatchUpdateException` 으로 감싸져 올라온다. main 코드에 DB 예외 종류를 잡는 곳은 없다
- DB CPU 를 더 줄이려면 run·item 진행 기록을 `@Modifying` JPQL 로 바꾸거나 묶음 커밋을 해야 한다. 이번 범위가 아니다
