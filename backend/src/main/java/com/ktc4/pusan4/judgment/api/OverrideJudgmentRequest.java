package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.Verdict;
import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record OverrideJudgmentRequest(
    @Schema(requiredMode = REQUIRED) Verdict toVerdict,
    @Schema(example = "개인적으로 사용한 비용입니다.") String reason
) {
}
