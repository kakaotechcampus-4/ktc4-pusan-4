package com.ktc4.pusan4.judgment.persistence;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RuleCandidatePersistenceService {

    private final RuleCandidateRepository candidateRepository;

    public RuleCandidatePersistenceService(RuleCandidateRepository candidateRepository) {
        this.candidateRepository = candidateRepository;
    }

    @Transactional
    public long save(SaveRuleCandidateCommand command) {
        return candidateRepository.saveAndFlush(new RuleCandidateEntity(command)).id();
    }
}
