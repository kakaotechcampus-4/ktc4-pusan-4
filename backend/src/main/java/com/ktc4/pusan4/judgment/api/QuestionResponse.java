package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=false 일 때의 항목")
public record QuestionResponse(
    UUID id,
    UUID batchId,
    UUID transactionId,
    @Schema(example = "merchant:스타벅스") String groupKey,
    @Schema(example = "용도") String factType,
    String questionText,
    List<String> options,
    Coded<QuestionStatus> status,
    UUID answeredFactId,
    OffsetDateTime createdAt,
    OffsetDateTime answeredAt
) {
}
