package com.ktc4.pusan4.judgment.domain;

import java.util.Set;

public final class AttributeOutcomePolicy {
    // 되묻기 답이 판정·계정과목·금액을 바꾸지 '않는' 정보성 속성. 여기 없는 속성은
    // 안전한지 모르므로 결과를 바꾸는 것으로 본다 — 모를 때는 확정이 아니라 되묻는다.
    // (증빙수취·가산세는 가산세만 계산할 뿐 경비 인정 여부·금액을 건드리지 않는다.)
    private static final Set<String> OUTCOME_NEUTRAL_ATTRIBUTES = Set.of(
        "증빙수취",
        "가산세_대상",
        "가산세율"
    );

    private AttributeOutcomePolicy() {}

    public static boolean changesOutcome(String attribute) {
        return !OUTCOME_NEUTRAL_ATTRIBUTES.contains(attribute);
    }
}