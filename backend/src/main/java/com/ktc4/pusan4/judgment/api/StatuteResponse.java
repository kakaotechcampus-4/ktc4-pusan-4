package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.StatuteVersion;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

public record StatuteResponse(
    @Schema(example = "1523") long statuteVersionId,
    @Schema(example = "소득세법시행령-67-4") String statuteId,
    @Schema(example = "소득세법 시행령 제67조 제4항") String title,
    @Schema(description = "법률·시행령·기본통칙·판례 등 표시 구분", example = "시행령") String hierarchy,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    String sourceUrl,
    String body
) {

    static StatuteResponse from(StatuteVersion statute) {
        return new StatuteResponse(statute.id(), statute.statuteId(), statute.title(), statute.hierarchy(),
            statute.effectiveFrom(), statute.effectiveTo(), statute.sourceUrl(), statute.body());
    }
}
