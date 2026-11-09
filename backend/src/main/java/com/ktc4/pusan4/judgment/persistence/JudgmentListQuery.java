package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Verdict;

import java.util.UUID;

/**
 * GET /judgments 의 조건 (api.md 3.7). 주어진 조건은 모두 AND 로 건다.
 *
 * <p>runId 가 있으면 그 Run 이 만든 판정, latestOnly=false 면 모든 revision, 그 외는 거래별 현재 판정이다.
 * runId 와 함께 온 latestOnly 는 보지 않는다.
 *
 * <p>awaiting 이 true 면 답변 대기(불가인데 답하지 않은 질문이 걸린 거래)만, false 면 그것을 뺀다. null 이면 거르지 않는다.
 */
public record JudgmentListQuery(
    UUID transactionId,
    UUID batchId,
    Integer year,
    Verdict verdict,
    boolean latestOnly,
    UUID runId,
    Boolean awaiting,
    Sort sort
) {

    /** 목록 정렬. 결과 표는 승인일 순으로 받는다. */
    public enum Sort {
        /** computedAt DESC, id DESC */
        COMPUTED_AT,
        /** 거래 approvedAt DESC, 판정 id DESC */
        APPROVED_AT
    }
}
