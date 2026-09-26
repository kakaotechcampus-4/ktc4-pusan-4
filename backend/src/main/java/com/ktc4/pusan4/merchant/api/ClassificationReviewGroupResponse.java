package com.ktc4.pusan4.merchant.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=true 일 때의 항목. 같은 merchantNorm 의 Review 를 한 카드로 묶는다")
public record ClassificationReviewGroupResponse(
    @Schema(example = "merchant:XYZ PAYMENTS") String groupKey,
    List<UUID> reviewIds,
    @Schema(description = "항상 reviewIds.length 와 같다") int count,
    long totalAmount,
    String merchantRaw,
    List<String> suggestedCategories
) {
}
