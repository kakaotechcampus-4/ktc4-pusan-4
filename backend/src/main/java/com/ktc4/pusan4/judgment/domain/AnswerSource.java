package com.ktc4.pusan4.judgment.domain;

/** 질문 답의 출처 (api.md 3.10 source). 판정에는 쓰지 않는다. */
public enum AnswerSource {
    USER,
    /** 비서 제안 카드를 사용자가 적용했다. */
    ASSISTANT,
    /** 지난번 답 불러오기를 사용자가 적용했다. */
    PREVIOUS_ANSWER,
    /** 일괄 응답(api.md 3.11). 시스템만 쓴다. */
    BULK
}
