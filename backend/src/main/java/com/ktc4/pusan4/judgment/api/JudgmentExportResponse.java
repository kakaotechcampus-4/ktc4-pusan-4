package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.JudgmentExportRow;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** 세무사에게 넘길 내보내기 (api.md 3.7 export). 페이지 없이 전부 준다. */
public record JudgmentExportResponse(List<Item> items) {

    public static JudgmentExportResponse from(List<JudgmentExportRow> rows) {
        return new JudgmentExportResponse(rows.stream()
            .map(row -> new Item(JudgmentResponse.from(row.judgment()), row.allowedAmount(), row.answers()))
            .toList());
    }

    public record Item(
        @Schema(description = "거래의 현재 판정. GET /judgments/{id} 와 같은 모양") JudgmentResponse judgment,
        @Schema(description = "한도까지 반영한 인정 금액. 접대비는 한도 인정액, 아니면 finalAmount. 요약(3.7 summary)과 같은 기준")
        Long allowedAmount,
        @Schema(description = "이 거래에 답한 질문 문구와 답. 답한 것이 없으면 빈 배열")
        List<JudgmentExportRow.Answer> answers
    ) {
    }
}
