package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RuleCandidatePersistenceService {

    private final EntityManager entityManager;

    public RuleCandidatePersistenceService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Transactional
    public long save(SaveRuleCandidateCommand command) {
        RuleCandidateEntity entity = new RuleCandidateEntity(command);
        entityManager.persist(entity);
        entityManager.flush();
        return entity.id();
    }
}
