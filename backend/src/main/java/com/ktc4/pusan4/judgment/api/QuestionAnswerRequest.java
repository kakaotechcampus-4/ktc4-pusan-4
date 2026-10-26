package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record QuestionAnswerRequest(
    @Schema(requiredMode = REQUIRED, description = "같은 Batch·groupKey·factType 에 속해야 한다")
    @NotEmpty List<@NotNull UUID> questionIds,
    @Schema(requiredMode = REQUIRED) @NotNull @Valid QuestionAnswer answer
) {
}
