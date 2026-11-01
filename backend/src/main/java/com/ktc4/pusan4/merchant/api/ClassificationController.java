package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewGroup;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewItem;
import com.ktc4.pusan4.transaction.domain.ClassificationReviewResult;
import com.ktc4.pusan4.transaction.persistence.ClassificationReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "classification", description = "가맹점 분류 확인 (api.md 3.5). 룰엔진 Question 과 별도 리소스")
@RestController
public class ClassificationController {

    private final ClassificationReviewService reviewService;

    public ClassificationController(ClassificationReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @Operation(summary = "미분류 확인 목록",
        description = "정렬: createdAt ASC, id ASC. grouped=true 이면 같은 merchantNorm 의 Review 를 한 그룹으로 묶고 "
            + "page·size 를 그룹 단위로 적용한다. unresolved 는 batchId 만 적용한 PENDING 집계다")
    @ApiResponse(responseCode = "200", description = "grouped 값에 따라 두 형태 중 하나",
        content = @Content(schema = @Schema(
            oneOf = {ClassificationReviewPage.class, ClassificationReviewGroupPage.class})))
    @GetMapping("/classification-reviews")
    public Object listReviews(
        CurrentUser currentUser,
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) ClassificationReviewStatus status,
        @RequestParam(defaultValue = "false") boolean grouped,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        if (grouped) {
            ClassificationReviewResult<ClassificationReviewGroup> result =
                reviewService.groups(currentUser.id(), batchId, status, page, size);
            return new ClassificationReviewGroupPage(
                result.page().getContent().stream().map(ClassificationReviewGroupResponse::from).toList(),
                ClassificationUnresolved.from(result), PageResponse.of(result.page()).page());
        }
        ClassificationReviewResult<ClassificationReviewItem> result =
            reviewService.list(currentUser.id(), batchId, status, page, size);
        return new ClassificationReviewPage(
            result.page().getContent().stream().map(ClassificationReviewResponse::from).toList(),
            ClassificationUnresolved.from(result), PageResponse.of(result.page()).page());
    }

    @Operation(summary = "미분류 거래 분류 응답",
        description = "Review → RESOLVED, Transaction.merchantCategory 확정, 답을 개인 가맹점 사전에 남긴다. "
            + "분류 응답은 UserFact 로 저장하지 않는다. Batch 에 완료된 JudgmentRun 이 있으면 그 run 의 문진 버전으로 "
            + "해결한 판정 대상 거래만 다시 판정한다(origin CLASSIFICATION_REVIEW)")
    @ApiResponse(responseCode = "404", description = "CLASSIFICATION_REVIEW_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CLASSIFICATION_ALREADY_RESOLVED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "INVALID_MERCHANT_CATEGORY, UNCLASSIFIED_CATEGORY_NOT_ALLOWED, "
        + "REVIEWS_FROM_DIFFERENT_BATCHES — reviewIds 가 서로 다른 배치에 걸쳐 있음",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/classification-responses")
    public ClassificationAnswerResponse answer(
        CurrentUser currentUser, @Valid @RequestBody ClassificationAnswerRequest request
    ) {
        return ClassificationAnswerResponse.from(
            reviewService.answer(currentUser.id(), request.reviewIds(), request.merchantCategory()));
    }
}
