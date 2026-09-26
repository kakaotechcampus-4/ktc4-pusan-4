package com.ktc4.pusan4.transaction.api;

/**
 * 파서 거래 상태 (api.md 2.2). effectiveStatus 도 같은 값을 쓴다.
 */
public enum SourceStatus {
    JUDGEABLE,
    CANCELED_OFFSET,
    EXCLUDED
}
