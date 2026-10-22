package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record CreateJudgmentRunRequest(
    @Schema(requiredMode = REQUIRED) @NotNull UUID batchId,
    @Schema(requiredMode = REQUIRED) @NotNull UUID contextId
) {
}
