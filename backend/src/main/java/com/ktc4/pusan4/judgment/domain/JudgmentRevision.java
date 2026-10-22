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

    public record JudgedTransaction(
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        String merchantCategory,
        long amount,
        int installmentMonths
    ) {
    }

    public record CitedStatute(long statuteVersionId, String statuteId) {
    }
}
