package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

import java.util.Optional;

interface RuleCandidateRepository extends Repository<RuleCandidateEntity, Long> {

    RuleCandidateEntity saveAndFlush(RuleCandidateEntity candidate);

    Optional<RuleCandidateEntity> findById(Long id);

    boolean existsById(Long id);

    /** 최신순은 Pageable 의 Sort 로 준다. */
    Page<RuleCandidateEntity> findAll(Pageable pageable);

    Page<RuleCandidateEntity> findByStatus(String status, Pageable pageable);
}
