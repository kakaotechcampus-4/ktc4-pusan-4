package com.ktc4.pusan4.user.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateContextRequest(
    @Schema(example = "940909") @NotBlank @Size(max = 6) String industryCode,
    @NotNull @PositiveOrZero Long prevYearRevenue,
    @NotNull LocalDate businessOpenDate,
    @NotNull BookkeepingDuty bookkeepingDuty,
    @NotNull Boolean hasEmployee,
    @Schema(description = "0~100") @Min(0) @Max(100) Integer homeOfficeRatio
) {
}
