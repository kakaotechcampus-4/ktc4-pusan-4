package com.ktc4.pusan4.judgment.domain;

/**
 * Question 상태 (api.md 2.5). CANCELED 는 시스템 전용이다.
 */
public enum QuestionStatus {
    PENDING,
    ANSWERED,
    CANCELED
}
