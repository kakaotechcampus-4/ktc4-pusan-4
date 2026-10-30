package com.ktc4.pusan4.judgment.domain;

/**
 * 다른 업로드에서 같은 질문에 한 답을 어떻게 보여줄지 (docs/agent-secretary.md 3.1, 카드 question.previous_answer).
 * 카드에 적지 않으면 NONE 이다.
 */
public enum PreviousAnswer {
    /** A. 직전 답을 이어받는다. 가맹점마다 답이 매달 같은 고정비. */
    CARRY("A"),
    /** B. 같은 가맹점의 지난 답 횟수만 보여준다. */
    HISTORY("B"),
    /** C. 보여주지 않는다. */
    NONE("C");

    private final String tier;

    PreviousAnswer(String tier) {
        this.tier = tier;
    }

    public String tier() {
        return tier;
    }

    /** 카드 YAML 값. 없으면 NONE, 모르는 값이면 null. */
    public static PreviousAnswer fromYaml(String value) {
        if (value == null) {
            return NONE;
        }
        return switch (value) {
            case "carry" -> CARRY;
            case "history" -> HISTORY;
            default -> null;
        };
    }
}
