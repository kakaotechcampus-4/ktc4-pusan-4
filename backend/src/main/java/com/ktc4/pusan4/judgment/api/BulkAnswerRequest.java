package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record BulkAnswerRequest(
    @Schema(requiredMode = REQUIRED, description = "이 Batch 의 PENDING Question 만 대상") @NotNull UUID batchId,
    @Schema(requiredMode = REQUIRED, description = "RuleCard question.fact_type 값", example = "용도") @NotBlank String factType,
    @Schema(requiredMode = REQUIRED) @NotNull @Valid QuestionAnswer answer
) {
}
