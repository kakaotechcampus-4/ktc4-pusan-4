package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.transaction.api.MerchantCategories;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=true 일 때의 항목. 같은 merchantNorm 의 Review 를 한 카드로 묶는다")
public record ClassificationReviewGroupResponse(
    @Schema(description = "그룹 식별 문자열. 형식을 보장하지 않으므로 파싱하지 않는다",
        example = "merchant:XYZ PAYMENTS") String groupKey,
    @Schema(description = "그룹 안 Review 들이 공유하는 정규화 이름. 화면 제목은 이 값을 쓴다",
        example = "XYZ PAYMENTS") String merchantNorm,
    List<UUID> reviewIds,
    @Schema(description = "항상 reviewIds.length, transactions.length 와 같다") int count,
    @Schema(description = "transactions[].amount 의 합") long totalAmount,
    @Schema(description = "그룹 대표 표기. transactions 의 첫 거래 표기다") String merchantRaw,
    List<String> suggestedCategories,
    @Schema(description = "Review 마다 거래 요약 하나. 잘라내지 않는다. 정렬: approvedAt ASC, transactionId ASC")
    List<ReviewTransaction> transactions
) {

    @Schema(description = "Review 와 그 거래 요약. 거래 요약 필드는 api.md 3.4 와 같다")
    public record ReviewTransaction(
        UUID reviewId,
        UUID transactionId,
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        @Schema(description = MerchantCategories.DESCRIPTION, example = "미분류") String merchantCategory,
        long amount,
        int installmentMonths
    ) {
    }
}
