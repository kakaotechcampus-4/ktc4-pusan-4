package com.ktc4.pusan4.user.api;

import com.ktc4.pusan4.user.domain.BookkeepingDuty;
import com.ktc4.pusan4.user.domain.NewBusinessContext;
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

    /** {@code @Valid} 를 통과한 뒤에만 부른다. 필수 필드는 null 이 아니다. */
    NewBusinessContext toInput() {
        return new NewBusinessContext(industryCode, prevYearRevenue, businessOpenDate, bookkeepingDuty,
            hasEmployee, homeOfficeRatio);
    }
}
