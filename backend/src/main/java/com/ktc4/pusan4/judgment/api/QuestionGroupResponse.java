package com.ktc4.pusan4.judgment.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=true 일 때의 항목. RuleCard 의 group_by(transaction / merchant_norm)를 따르고, "
    + "같은 groupKey 라도 factType 이 다르면 별도 그룹이다")
public record QuestionGroupResponse(
    @Schema(example = "merchant:스타벅스") String groupKey,
    @Schema(example = "용도") String factType,
    List<UUID> questionIds,
    @Schema(description = "항상 questionIds.length 와 같다") int count,
    long totalAmount,
    String questionText,
    List<String> options
) {
}
