package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record QuestionAnswer(
    @Schema(requiredMode = REQUIRED, description = "대상 Question 의 options 에 포함되는 값", example = "사업") String value
) {
}
