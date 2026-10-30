package com.ktc4.pusan4.progress.domain;

import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;

/**
 * 업로드 하나에서 다음에 할 일 (api.md 3.14 진행 상황). 화면 순서대로 처음 끝나지 않은 단계다.
 * route 는 이동 카드로 쓰이므로 판정 실행 화면(/run)은 두지 않는다. 그 화면은 실행 id 없이 들어오면 판정을 새로 시작한다.
 */
public enum NextStep {
    CLASSIFY("/preview", "분류 확인하기"),
    INTERVIEW("/interview", "사업자 문진 작성하기"),
    CONFIRM("/confirm", "판정 시작하기"),
    QUESTIONS("/questions", "질문에 답하기"),
    RESULTS("/results", "결과 보기");

    private final String route;
    private final String label;

    NextStep(String route, String label) {
        this.route = route;
        this.label = label;
    }

    public String route() {
        return route;
    }

    public String label() {
        return label;
    }

    /** @param lastRun 이 업로드의 마지막 판정 실행. 없으면 null */
    public static NextStep of(
        boolean classificationPending, boolean hasContext, JudgmentRunStatus lastRun, boolean questionsPending
    ) {
        if (classificationPending) {
            return CLASSIFY;
        }
        if (!hasContext) {
            return INTERVIEW;
        }
        if (lastRun == null || lastRun == JudgmentRunStatus.FAILED) {
            return CONFIRM;
        }
        // 실행 중이어도 판정된 거래의 질문과 결과는 이미 볼 수 있다. 진행 여부는 run.status 로 따로 준다.
        return questionsPending ? QUESTIONS : RESULTS;
    }
}
