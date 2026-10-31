package com.ktc4.pusan4.judgment.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ktc4.pusan4.judgment.domain.PreviousAnswerSuggestion;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

/** 지난번 답 (api.md 3.14). 등급에 맞는 필드만 싣는다. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuestionSuggestionResponse(
    String groupKey,
    String factType,
    String code,
    @Schema(description = "A 이어받기, B 이력만, C 띄우지 않음", allowableValues = {"A", "B", "C"}) String tier,
    @Schema(description = "A 에서 이어받을 값. 충돌·일괄 응답·이력 없음이면 없다") String value,
    @Schema(description = "value 를 답한 업로드. 예 「9월 업로드(국민)」") String sourceLabel,
    @Schema(description = "A 에서 최근 두 업로드의 답이 다르면 true") Boolean conflict,
    @Schema(description = "A 에서 value 를 채우지 않은 사정") List<PreviousAnswerSuggestion.History> history,
    @Schema(description = "B 에서 같은 가맹점의 지난 답 값별 질문 수") Map<String, Integer> historyCounts,
    @Schema(description = "C 에서 보여주지 않는 이유") String reason
) {

    static QuestionSuggestionResponse from(PreviousAnswerSuggestion suggestion) {
        return new QuestionSuggestionResponse(suggestion.groupKey(), suggestion.factType(), suggestion.code(),
            suggestion.tier(), suggestion.value(), suggestion.sourceLabel(), suggestion.conflict(),
            suggestion.history(), suggestion.historyCounts(), suggestion.reason());
    }

    public record Page(List<QuestionSuggestionResponse> items) {
    }
}
