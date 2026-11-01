package com.ktc4.pusan4.judgment.persistence;

import java.util.List;

public record SaveRuleCandidateCommand(
    String merchantCategory,
    String industryCode,
    int distinctUsers,
    int occurrenceCount,
    List<SuggestedDocJson> suggestedDocs,
    String searchedTier,
    String draftYaml
) {
    public SaveRuleCandidateCommand {
        suggestedDocs = List.copyOf(suggestedDocs);
    }
}
