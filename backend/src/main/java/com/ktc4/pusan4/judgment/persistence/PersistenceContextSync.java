package com.ktc4.pusan4.judgment.persistence;

/**
 * Repository 에 붙이는 조각(Spring Data fragment). 구현은 PersistenceContextSyncImpl 이다.
 * JPQL bulk update 는 DB 에만 반영되고 이미 읽은 엔티티는 그대로라, 같은 트랜잭션에서 다시 읽으면 옛 값이 나온다.
 */
interface PersistenceContextSync {

    /** 바뀐 엔티티를 DB 에 반영하고 영속성 컨텍스트를 비운다. 이후 조회는 DB 값을 읽는다. 들고 있던 엔티티는 더 고쳐도 저장되지 않는다. */
    void flushAndClear();
}
