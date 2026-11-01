package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.EntityManager;

class PersistenceContextSyncImpl implements PersistenceContextSync {

    private final EntityManager entityManager;

    PersistenceContextSyncImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
