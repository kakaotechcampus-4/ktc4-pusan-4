package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.util.UUID;

/**
 * 다른 업로드에서 답한 질문 하나 (api.md 3.14 지난번 답). 질문마다 한 줄이고, 값은 그 질문이 가리키는 UserFact 다.
 *
 * @param version 그 업로드 안에서 같은 질문을 정정한 차례. 업로드마다 가장 큰 것이 마지막 답이다
 */
public record PastAnswer(
    String code,
    String groupKey,
    String merchantNorm,
    String value,
    AnswerSource source,
    UUID batchId,
    LocalDate periodStart,
    LocalDate periodEnd,
    String cardIssuer,
    int version
) {

    public String sourceLabel() {
        return sourceLabel(periodStart, periodEnd, cardIssuer);
    }

    /** 「9월 업로드(국민)」. 사실 그대로 쓴다(agent-secretary.md 3.1). */
    static String sourceLabel(LocalDate start, LocalDate end, String cardIssuer) {
        String months;
        if (start.getYear() != end.getYear()) {
            months = start.getYear() + "." + start.getMonthValue() + "~" + end.getYear() + "." + end.getMonthValue();
        } else if (start.getMonthValue() == end.getMonthValue()) {
            months = start.getMonthValue() + "월";
        } else {
            months = start.getMonthValue() + "~" + end.getMonthValue() + "월";
        }
        return months + " 업로드(" + cardIssuer + ")";
    }
}
