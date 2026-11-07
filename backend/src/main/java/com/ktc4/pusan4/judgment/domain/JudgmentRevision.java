package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 저장된 판정 revision 하나 (api.md 3.7).
 *
 * @param transaction 판정 당시가 아니라 조회 시점의 거래 값
 */
public record JudgmentRevision(
    UUID id,
    UUID transactionId,
    JudgedTransaction transaction,
    int revision,
    JudgmentOrigin origin,
    Verdict verdict,
    Gate blockedAtGate,
    boolean outOfScope,
    String account,
    Long finalAmount,
    boolean inference,
    UnmatchedReason unmatchedReason,
    Map<String, Object> attributes,
    String ruleCardId,
    Integer ruleCardVersion,
    List<String> appliedRuleIds,
    String rulesCommitSha,
    int userContextVersion,
    OffsetDateTime computedAt,
    List<CitedStatute> citations
) {

    /** @param reviewReason 파서가 남긴 사유(transaction.review_reason). 정상 상계 행에도 있어 needs_review 와 같이 봐야 한다 */
    public record JudgedTransaction(
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        String merchantCategory,
        long amount,
        int installmentMonths,
        String reviewReason
    ) {
        public JudgedTransaction(
            LocalDate approvedAt,
            String merchantRaw,
            String merchantNorm,
            String merchantCategory,
            long amount,
            int installmentMonths
        ) {
            this(approvedAt, merchantRaw, merchantNorm, merchantCategory, amount, installmentMonths, null);
        }
    }

    public record CitedStatute(long statuteVersionId, String statuteId) {
    }
}
