package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;

/**
 * 법령 원문 한 버전. 법령 동기화(law_sync.py)가 쌓고 backend 는 읽기만 한다.
 */
public record StatuteVersion(
    long id,
    String statuteId,
    String title,
    String hierarchy,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    String sourceUrl,
    String body
) {
}
