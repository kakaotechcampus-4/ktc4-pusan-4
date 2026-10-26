package com.ktc4.pusan4.admin.domain;

import java.time.OffsetDateTime;
import java.util.List;

/** 여러 사용자에게서 판정할 규칙이 없던 업종·카테고리 조합과 그 규칙 카드 초안 (AI 규칙 후보 파이프라인이 만든다). */
public record RuleCandidate(
    long id,
    String merchantCategory,
    String industryCode,
    int distinctUsers,
    int occurrenceCount,
    List<SuggestedDoc> suggestedDocs,
    String searchedTier,
    String draftYaml,
    RuleCandidateStatus status,
    String reviewedBy,
    OffsetDateTime reviewedAt,
    OffsetDateTime createdAt
) {

    /** 초안이 인용한 근거. tier 는 인용이 나온 위계(법령·행정규칙 등), 못 찾았으면 null */
    public record SuggestedDoc(String statuteId, String quote, String tier) {
    }
}
