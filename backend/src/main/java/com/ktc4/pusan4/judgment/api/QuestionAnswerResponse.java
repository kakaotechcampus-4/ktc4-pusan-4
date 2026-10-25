package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.persistence.QuestionAnswerResult;

import java.util.UUID;

public record QuestionAnswerResponse(int answeredCount, UUID factId, int rejudgedTransactionCount) {

    static QuestionAnswerResponse from(QuestionAnswerResult result) {
        return new QuestionAnswerResponse(result.answeredCount(), result.factId(), result.rejudgedTransactionCount());
    }
}
