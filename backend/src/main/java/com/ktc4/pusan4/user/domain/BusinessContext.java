package com.ktc4.pusan4.user.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 사업자 Context 한 버전 (api.md 3.2). 수정하지 않고 새 버전을 만든다.
 */
public record BusinessContext(
    UUID id,
    UUID userId,
    int version,
    String industryCode,
    long prevYearRevenue,
    LocalDate businessOpenDate,
    BookkeepingDuty bookkeepingDuty,
    boolean hasEmployee,
    Integer homeOfficeRatio,
    OffsetDateTime createdAt
) {
}
