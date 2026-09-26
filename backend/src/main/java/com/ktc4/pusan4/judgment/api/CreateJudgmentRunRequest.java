package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record CreateJudgmentRunRequest(
    @Schema(requiredMode = REQUIRED) UUID batchId,
    @Schema(requiredMode = REQUIRED) UUID contextId
) {
}
