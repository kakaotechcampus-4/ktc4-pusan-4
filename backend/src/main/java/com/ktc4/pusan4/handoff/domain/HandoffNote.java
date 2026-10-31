package com.ktc4.pusan4.handoff.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** 세무대리인에게 물을 질문 하나 (docs/agent-secretary.md FR-16). 요약의 「세무대리인에게 넘길 문장」에 들어간다. */
public record HandoffNote(UUID id, String text, List<UUID> transactionIds, OffsetDateTime createdAt) {
}
