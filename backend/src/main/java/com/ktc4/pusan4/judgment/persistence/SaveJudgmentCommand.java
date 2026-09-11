package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.UserFact;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SaveJudgmentCommand(
    UUID transactionId,
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
        inputFacts = List.copyOf(inputFacts);
    }

    public SaveJudgmentCommand(
        UUID transactionId,
        String rulesCommitSha,
        int userContextVersion,
        int taxYear,
        LocalDate statuteEffectiveDate,
        List<UserFact> inputFacts,
        Judgment judgment
    ) {
        this(
            transactionId, rulesCommitSha, userContextVersion, taxYear,
            statuteEffectiveDate, null, null, null, inputFacts, judgment
        );
    }
}
