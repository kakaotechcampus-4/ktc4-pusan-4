package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.persistence.QuestionWithdrawResult;

public record QuestionWithdrawResponse(int withdrawnCount, int rejudgedTransactionCount) {

    static QuestionWithdrawResponse from(QuestionWithdrawResult result) {
        return new QuestionWithdrawResponse(result.withdrawnCount(), result.rejudgedTransactionCount());
    }
}
