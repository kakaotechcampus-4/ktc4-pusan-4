package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

public record CitationResponse(
    @Schema(example = "1523") long statuteVersionId,
    @Schema(example = "소득세법시행령-67-4") String statuteId
) {
}
