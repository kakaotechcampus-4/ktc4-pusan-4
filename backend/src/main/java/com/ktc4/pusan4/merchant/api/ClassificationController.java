package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "classification", description = "가맹점 분류 확인 (api.md 3.5). 룰엔진 Question 과 별도 리소스")
@RestController
public class ClassificationController {

    private final ClassificationMockData mockData;

    public ClassificationController(ClassificationMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "미분류 확인 목록",
        description = "정렬: createdAt ASC, id ASC. grouped=true 이면 항목이 그룹 형태로 바뀐다")
    @ApiResponse(responseCode = "200", description = "grouped 값에 따라 두 형태 중 하나",
        content = @Content(schema = @Schema(
            oneOf = {ClassificationReviewPage.class, ClassificationReviewGroupPage.class})))
    @GetMapping("/classification-reviews")
    public Object listReviews(
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) ClassificationReviewStatus status,
        @RequestParam(defaultValue = "false") boolean grouped,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return grouped ? mockData.reviewGroups() : mockData.reviews();
    }

    @MockResponse
    @Operation(summary = "미분류 거래 분류 응답",
        description = "Review → RESOLVED, Transaction.merchantCategory 확정. 분류 응답은 UserFact 로 저장하지 않는다")
    @ApiResponse(responseCode = "404", description = "CLASSIFICATION_REVIEW_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CLASSIFICATION_ALREADY_RESOLVED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "INVALID_MERCHANT_CATEGORY, UNCLASSIFIED_CATEGORY_NOT_ALLOWED, "
        + "REVIEWS_FROM_DIFFERENT_BATCHES — reviewIds 가 서로 다른 배치에 걸쳐 있음",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/classification-responses")
    public ClassificationAnswerResponse answer(@RequestBody ClassificationAnswerRequest request) {
        return mockData.answer();
    }
}
