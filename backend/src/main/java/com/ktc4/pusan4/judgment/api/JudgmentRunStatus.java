package com.ktc4.pusan4.judgment.api;

/**
 * JudgmentRun 상태 (api.md 2.7). NEEDS_REVIEW 판정이 있어도 COMPLETED 다.
 * PARTIAL_FAILED·FAILED 는 기술적 처리 실패만 뜻한다.
 */
public enum JudgmentRunStatus {
    QUEUED,
    RUNNING,
    COMPLETED,
    PARTIAL_FAILED,
    FAILED
}
