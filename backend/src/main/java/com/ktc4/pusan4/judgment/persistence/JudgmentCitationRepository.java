package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.repository.Repository;

interface JudgmentCitationRepository extends Repository<JudgmentCitationEntity, Long> {

    JudgmentCitationEntity save(JudgmentCitationEntity citation);
}
