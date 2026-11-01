package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewItem;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "grouped=false 일 때의 항목")
public record ClassificationReviewResponse(
    UUID id,
    UUID batchId,
    UUID transactionId,
    String merchantRaw,
    String merchantNorm,
    Coded<ClassificationReviewStatus> status,
    @Schema(description = "제안할 카테고리. 제안 근거가 아직 없어 빈 배열이다") List<String> suggestedCategories,
    OffsetDateTime createdAt,
    OffsetDateTime resolvedAt
) {

    // 분류기가 제안 근거를 남기지 않는다. 분류 AI(B10)가 붙으면 채운다.
    static final List<String> NO_SUGGESTIONS = List.of();

    static ClassificationReviewResponse from(ClassificationReviewItem review) {
        return new ClassificationReviewResponse(review.id(), review.batchId(), review.transactionId(),
            review.merchantRaw(), review.merchantNorm(), status(review.status()), NO_SUGGESTIONS,
            review.createdAt(), review.resolvedAt());
    }

    /** 화면 문구는 api.md 2.6 을 따른다. */
    static Coded<ClassificationReviewStatus> status(ClassificationReviewStatus status) {
        String label = switch (status) {
            case PENDING -> "대기";
            case RESOLVED -> "해결";
        };
        return new Coded<>(status, label);
    }
}
