package com.ktc4.pusan4.judgment.persistence;

/**
 * run 항목이 실패한 이유 (api.md 3.6 errorCode). 응답으로 나가므로 문구는 고정이고, 원인은 로그에만 남긴다.
 */
enum JudgmentRunItemError {

    /** 그 거래를 판정하다 기술적으로 실패했다. */
    RULE_PROCESSING_FAILED("판정 처리 중 오류가 발생했습니다."),
    /** run 을 시작하지 못했다(Context 를 읽지 못함 등). */
    RUN_START_FAILED("판정을 시작하지 못했습니다. 판정을 다시 실행해 주세요."),
    /** 실행하던 서버가 내려가 run 이 멈췄다. */
    RUN_INTERRUPTED("서버가 다시 시작되어 판정이 중단되었습니다. 판정을 다시 실행해 주세요.");

    private final String message;

    JudgmentRunItemError(String message) {
        this.message = message;
    }

    String message() {
        return message;
    }
}
