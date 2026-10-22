package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.UserFact;

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
    List<UserFact> inputFacts,
    Judgment judgment
) {
    public SaveJudgmentCommand {
        Objects.requireNonNull(origin, "origin is required");
        inputFacts = List.copyOf(inputFacts);
    }

    public SaveJudgmentCommand(
        UUID transactionId,
        JudgmentOrigin origin,
        String rulesCommitSha,
        int userContextVersion,
        int taxYear,
        LocalDate statuteEffectiveDate,
        List<UserFact> inputFacts,
        Judgment judgment
    ) {
        this(
            transactionId, origin, rulesCommitSha, userContextVersion, taxYear,
            statuteEffectiveDate, null, null, null, inputFacts, judgment
        );
    }
}
