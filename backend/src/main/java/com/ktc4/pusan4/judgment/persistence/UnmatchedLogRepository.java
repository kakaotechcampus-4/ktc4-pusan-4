package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.repository.Repository;

interface UnmatchedLogRepository extends Repository<UnmatchedLogEntity, Long> {

    UnmatchedLogEntity save(UnmatchedLogEntity unmatchedLog);
}
