package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=false 일 때의 항목")
public record QuestionResponse(
    UUID id,
    UUID batchId,
    UUID transactionId,
    @Schema(example = "merchant:스타벅스") String groupKey,
    @Schema(example = "용도") String factType,
    @Schema(description = "규칙 카드의 질문 코드. 다른 업로드의 같은 질문을 찾을 때 쓴다", example = "CAFE_PURPOSE") String code,
    String questionText,
    List<String> options,
    Coded<QuestionStatus> status,
    UUID answeredFactId,
    @Schema(description = "답한 값. ANSWERED 가 아니면 null. 정정했으면 마지막 답") QuestionAnswer answer,
    OffsetDateTime createdAt,
    OffsetDateTime answeredAt
) {

    static QuestionResponse from(Question question) {
        return new QuestionResponse(question.id(), question.batchId(), question.transactionId(), question.groupKey(),
            question.factType(), question.code(), question.questionText(), question.options(), status(question.status()),
            question.answeredFactId(), answer(question.answer()), question.createdAt(), question.answeredAt());
    }

    /** 화면 문구는 api.md 2.5 를 따른다. */
    static Coded<QuestionStatus> status(QuestionStatus status) {
        String label = switch (status) {
            case PENDING -> "대기";
            case ANSWERED -> "응답";
            case CANCELED -> "취소";
        };
        return new Coded<>(status, label);
    }

    static QuestionAnswer answer(String value) {
        return value == null ? null : new QuestionAnswer(value);
    }
}
