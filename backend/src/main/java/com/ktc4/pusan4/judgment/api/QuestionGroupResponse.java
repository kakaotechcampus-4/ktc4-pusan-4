package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.transaction.api.MerchantCategories;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=true 일 때의 항목. 같은 Batch·groupKey·factType·status 의 Question 을 묶는다. "
    + "groupKey 는 RuleCard 의 group_by(transaction / merchant_norm)를 따른다")
public record QuestionGroupResponse(
    @Schema(example = "merchant:스타벅스") String groupKey,
    @Schema(example = "용도") String factType,
    @Schema(description = "그룹 안 Question 의 상태. 그룹 안에서 모두 같다") Coded<QuestionStatus> status,
    List<UUID> questionIds,
    @Schema(description = "항상 questionIds.length, transactions.length 와 같다") int count,
    @Schema(description = "transactions[].amount 의 합") long totalAmount,
    String questionText,
    List<String> options,
    @Schema(description = "status = ANSWERED 면 그룹이 공유하는 답, 아니면 null. "
        + "답변·정정은 같은 Batch·groupKey·factType 의 Question 을 모두 같은 UserFact 로 바꾸므로 그룹 안에서 갈리지 않는다")
    QuestionAnswer answer,
    @Schema(description = "그룹의 Question 이 모두 일괄 응답(api.md 3.11) 대상이면 true. "
        + "PENDING 이 아니거나 소명 대기 거래의 Question 이 하나라도 있으면 false")
    boolean bulkAnswerable,
    @Schema(description = "Question 마다 거래 요약 하나. 잘라내지 않는다. 정렬: approvedAt ASC, transactionId ASC")
    List<QuestionTransaction> transactions
) {

    @Schema(description = "Question 과 그 거래 요약. 거래 요약 필드는 api.md 3.4 와 같다")
    public record QuestionTransaction(
        UUID questionId,
        UUID transactionId,
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        @Schema(description = MerchantCategories.DESCRIPTION, example = "카페") String merchantCategory,
        long amount,
        int installmentMonths,
        @Schema(description = "그 거래에 활성 Override 가 있으면 true. 답해도 현재 결과는 Override 판정 그대로다")
        boolean overridden
    ) {
    }
}
