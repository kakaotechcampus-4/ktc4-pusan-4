package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.repository.Repository;

interface RuleCandidateRepository extends Repository<RuleCandidateEntity, Long> {

    RuleCandidateEntity saveAndFlush(RuleCandidateEntity candidate);
}
