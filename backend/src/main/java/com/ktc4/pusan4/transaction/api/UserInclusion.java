package com.ktc4.pusan4.transaction.api;

/**
 * 사용자 포함 상태 (api.md 2.3). api.md 예시대로 {code, label} 이 아니라 값 그대로 응답한다.
 */
public enum UserInclusion {
    AUTO,
    INCLUDED,
    EXCLUDED
}
