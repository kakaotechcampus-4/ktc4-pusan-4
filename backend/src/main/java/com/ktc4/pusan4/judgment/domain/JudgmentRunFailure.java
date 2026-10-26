package com.ktc4.pusan4.judgment.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/** run 에서 기술적으로 실패한 거래 한 건 (api.md 3.6 failures). */
public record JudgmentRunFailure(UUID transactionId, String errorCode, String message, OffsetDateTime failedAt) {
}
