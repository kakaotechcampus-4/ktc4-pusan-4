package com.ktc4.pusan4.judgment.api;

import java.util.UUID;

public record QuestionAnswerResponse(int answeredCount, UUID factId, int rejudgedTransactionCount) {
}
