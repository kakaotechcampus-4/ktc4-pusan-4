package com.ktc4.pusan4.admin.api;

import com.ktc4.pusan4.admin.domain.RuleCandidate;
import com.ktc4.pusan4.admin.domain.RuleCandidate.SuggestedDoc;
import com.ktc4.pusan4.admin.domain.RuleCandidateStatus;
import com.ktc4.pusan4.shared.api.Coded;

import java.time.OffsetDateTime;
import java.util.List;

public record RuleCandidateResponse(
    long id,
    String merchantCategory,
    String industryCode,
    int distinctUsers,
    int occurrenceCount,
    List<SuggestedDoc> suggestedDocs,
    String searchedTier,
    String draftYaml,
    Coded<RuleCandidateStatus> status,
    String reviewedBy,
    OffsetDateTime reviewedAt,
    OffsetDateTime createdAt
) {

    static RuleCandidateResponse from(RuleCandidate candidate) {
        return new RuleCandidateResponse(candidate.id(), candidate.merchantCategory(), candidate.industryCode(),
            candidate.distinctUsers(), candidate.occurrenceCount(), candidate.suggestedDocs(),
            candidate.searchedTier(), candidate.draftYaml(),
            new Coded<>(candidate.status(), candidate.status().dbValue()),
            candidate.reviewedBy(), candidate.reviewedAt(), candidate.createdAt());
    }
}
