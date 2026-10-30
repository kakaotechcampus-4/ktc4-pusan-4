package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.RuleCandidateStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 규칙 후보 승인·기각. 확인(지금 처리할 수 있는 상태인가)과 변경을 UPDATE 한 문장으로 해서,
 * 두 관리자가 동시에 눌러도 한 번만 바뀐다. 엔티티를 읽고 고치면 둘 다 "대기" 를 읽고 둘 다 바꿀 수 있다.
 */
@Repository
class RuleCandidateReviewRepository {

    private static final List<String> REVIEWABLE = List.of(
        RuleCandidateStatus.PENDING.dbValue(), RuleCandidateStatus.IN_REVIEW.dbValue(),
        RuleCandidateStatus.ON_HOLD.dbValue());

    private final JdbcClient jdbc;

    RuleCandidateReviewRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** @return 바꿨으면 true. 없거나 이미 승인·기각한 후보면 false */
    boolean review(long candidateId, RuleCandidateStatus decision, String reviewer) {
        return jdbc.sql("""
                update rule_candidate
                   set status = :decision, reviewed_by = :reviewer, reviewed_at = now()
                 where id = :id and status in (:reviewable)
                """)
            .param("decision", decision.dbValue())
            .param("reviewer", reviewer)
            .param("id", candidateId)
            .param("reviewable", REVIEWABLE)
            .update() == 1;
    }
}
