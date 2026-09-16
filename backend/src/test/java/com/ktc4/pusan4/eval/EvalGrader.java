package com.ktc4.pusan4.eval;

import com.ktc4.pusan4.judgment.domain.Citation;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.Verdict;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * 판정 한 건을 기대값과 비교한다.
 *
 * <p>치명(머지 차단)은 사용자에게 틀린 확정 답이 나간 경우로 한정한다. 인정 안 되는 지출을
 * {@code 가능} 으로 내보내는 오탐과, 인정되는 지출을 {@code 불가} 로 내보내는 미탐이 같은 등급이다.
 * 확인필요는 판정을 넘긴 것이지 틀린 답을 준 게 아니라서 치명이 아니다 — 카드가 없어도 CI 가 통과하는 이유다.
 */
final class EvalGrader {

    enum Outcome { MATCH, SHORTFALL, CRITICAL, ON_HOLD }

    record Grade(Outcome outcome, List<String> problems) {
    }

    private EvalGrader() {
    }

    static Grade grade(EvalCase evalCase, Judgment judgment) {
        if (evalCase.onHold()) {
            return new Grade(Outcome.ON_HOLD, List.of());
        }
        EvalCase.Expectation expected = evalCase.expected();
        List<String> cited = judgment.citations().stream().map(Citation::statuteId).toList();
        boolean finalVerdict = judgment.verdict() != Verdict.NEEDS_REVIEW;
        List<String> critical = new ArrayList<>();
        List<String> mismatch = new ArrayList<>();

        if (finalVerdict && cited.isEmpty()) {
            critical.add("근거 없는 확정 판정(" + label(judgment.verdict()) + ")");
        }
        expected.citationsExcluded().stream()
            .filter(cited::contains)
            .forEach(statute -> critical.add("인용하면 안 되는 조문 인용: " + statute));
        if (judgment.verdict() == Verdict.AVAILABLE && expected.verdict() != Verdict.AVAILABLE) {
            critical.add("오탐: 기대 " + label(expected.verdict()) + ", 실제 가능");
        }
        if (judgment.verdict() == Verdict.UNAVAILABLE && expected.verdict() == Verdict.AVAILABLE) {
            critical.add("미탐: 기대 가능, 실제 불가");
        }

        if (judgment.verdict() != expected.verdict()) {
            mismatch.add("판정: 기대 " + label(expected.verdict()) + ", 실제 " + label(judgment.verdict()));
        }
        if (expected.gateSpecified() && judgment.blockedAtGate() != expected.gate()) {
            mismatch.add("걸린게이트: 기대 " + expected.gate() + ", 실제 " + judgment.blockedAtGate());
        }
        expected.citationsIncluded().stream()
            .filter(statute -> !cited.contains(statute))
            .forEach(statute -> mismatch.add("근거 누락: " + statute));
        if (expected.inference() != null && expected.inference() != judgment.inference()) {
            mismatch.add("is_inference: 기대 " + expected.inference() + ", 실제 " + judgment.inference());
        }
        expected.attributes().forEach((key, value) -> {
            Object actual = judgment.attributes().get(key);
            if (!Objects.equals(actual, value)) {
                mismatch.add("속성 " + key + ": 기대 " + value + ", 실제 " + actual);
            }
        });

        if (evalCase.critical() && finalVerdict) {
            critical.addAll(mismatch);
        }
        if (!critical.isEmpty()) {
            return new Grade(Outcome.CRITICAL, Stream.concat(critical.stream(), mismatch.stream()).distinct().toList());
        }
        return mismatch.isEmpty()
            ? new Grade(Outcome.MATCH, List.of())
            : new Grade(Outcome.SHORTFALL, List.copyOf(mismatch));
    }

    static String label(Verdict verdict) {
        return switch (verdict) {
            case AVAILABLE -> "가능";
            case UNAVAILABLE -> "불가";
            case NEEDS_REVIEW -> "확인필요";
        };
    }
}
