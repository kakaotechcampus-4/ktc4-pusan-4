package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.JudgmentExportRow;
import com.ktc4.pusan4.judgment.domain.LimitYearTotal;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** 세무사에게 넘길 내보내기 (api.md 3.7 export). 페이지 없이 전부 준다. */
public record JudgmentExportResponse(
    List<Item> items,
    @Schema(description = "범위에 접대비 판정이 있는 과세연도마다 한도 합계와 초과액. 과세연도 순")
    List<LimitYearResponse> limits
) {

    public static JudgmentExportResponse from(
        List<JudgmentExportRow> rows, List<LimitYearTotal> limits, RuleSet rules
    ) {
        return new JudgmentExportResponse(rows.stream()
            .map(row -> new Item(JudgmentResponse.from(row.judgment(), rules, row.pendingQuestion()), row.allowedAmount(), row.answers()))
            .toList(), LimitYearResponse.from(limits, rules));
    }

    public record Item(
        @Schema(description = "거래의 현재 판정. GET /judgments/{id} 와 같은 모양") JudgmentResponse judgment,
        @Schema(description = "인정 금액(finalAmount). 접대비 판정은 그해 한도를 넘었으면 null 이다. "
            + "넘은 해의 거래별 인정액은 법이 정하지 않아 limits 의 연 초과액으로만 준다")
        Long allowedAmount,
        @Schema(description = "이 거래에 답한 질문 문구와 답. 답한 것이 없으면 빈 배열")
        List<JudgmentExportRow.Answer> answers
    ) {
    }
}
