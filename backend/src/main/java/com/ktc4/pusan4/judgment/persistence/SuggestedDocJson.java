package com.ktc4.pusan4.judgment.persistence;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * rule_candidate.suggested_docs 의 한 항목. AI 파이프라인(ai/pipeline/candidates.py)이 쓰는 모양
 * {@code {statute_id, quote, tier}} 그대로다. tier 는 인용이 나온 위계이고, 못 찾았으면 null.
 */
public record SuggestedDocJson(@JsonProperty("statute_id") String statuteId, String quote, String tier) {
}
