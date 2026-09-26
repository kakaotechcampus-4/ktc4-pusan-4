package com.ktc4.pusan4.user.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ContextResponse(
    UUID id,
    UUID userId,
    int version,
    @Schema(example = "62010") String industryCode,
    long prevYearRevenue,
    LocalDate businessOpenDate,
    BookkeepingDuty bookkeepingDuty,
    boolean hasEmployee,
    @Schema(description = "미입력 시 null") Integer homeOfficeRatio,
    OffsetDateTime createdAt
) {
}
