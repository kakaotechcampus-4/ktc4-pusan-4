package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record SaveJudgmentCommand(
    UUID transactionId,
    JudgmentOrigin origin,
    String rulesCommitSha,
    int userContextVersion,
    int taxYear,
    LocalDate statuteEffectiveDate,
    String merchantCategory,
    String merchantRaw,
    String industryCode,
    List<UUID> inputFactIds,
    Judgment judgment,
    Long finalAmount
) {
    public SaveJudgmentCommand {
        Objects.requireNonNull(origin, "origin is required");
        inputFactIds = List.copyOf(inputFactIds);
    }

    /** 금액을 계산하지 않고 저장한다(final_amount 가 비어 있다). */
    public SaveJudgmentCommand(
        UUID transactionId,
        JudgmentOrigin origin,
        String rulesCommitSha,
        int userContextVersion,
        int taxYear,
        LocalDate statuteEffectiveDate,
        String merchantCategory,
        String merchantRaw,
        String industryCode,
        List<UUID> inputFactIds,
        Judgment judgment
    ) {
        this(
            transactionId, origin, rulesCommitSha, userContextVersion, taxYear, statuteEffectiveDate,
            merchantCategory, merchantRaw, industryCode, inputFactIds, judgment, null
        );
    }

    public SaveJudgmentCommand(
        UUID transactionId,
        JudgmentOrigin origin,
        String rulesCommitSha,
        int userContextVersion,
        int taxYear,
        LocalDate statuteEffectiveDate,
        List<UUID> inputFactIds,
        Judgment judgment
    ) {
        this(
            transactionId, origin, rulesCommitSha, userContextVersion, taxYear,
            statuteEffectiveDate, null, null, null, inputFactIds, judgment
        );
    }
}
