package com.ktc4.pusan4.user.domain;

import java.time.LocalDate;

/**
 * 문진 입력. 버전·id 는 서버가 정한다.
 */
public record NewBusinessContext(
    String industryCode,
    long prevYearRevenue,
    LocalDate businessOpenDate,
    BookkeepingDuty bookkeepingDuty,
    boolean hasEmployee,
    Integer homeOfficeRatio
) {
}
