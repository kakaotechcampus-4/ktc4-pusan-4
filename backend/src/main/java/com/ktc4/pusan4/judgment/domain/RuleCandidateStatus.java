package com.ktc4.pusan4.judgment.domain;

/** rule_candidate.status. DB 에는 한글(대기·검토중·승인·기각·보류)로 들어 있다. */
public enum RuleCandidateStatus {
    PENDING("대기"),
    IN_REVIEW("검토중"),
    APPROVED("승인"),
    REJECTED("기각"),
    ON_HOLD("보류");

    private final String dbValue;

    RuleCandidateStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    public static RuleCandidateStatus fromDb(String value) {
        for (RuleCandidateStatus status : values()) {
            if (status.dbValue.equals(value)) {
                return status;
            }
        }
        throw new IllegalStateException("알 수 없는 rule_candidate.status: " + value);
    }
}
