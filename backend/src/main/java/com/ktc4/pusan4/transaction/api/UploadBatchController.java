package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "upload-batches", description = "카드내역 업로드 (api.md 3.3)")
@RestController
@RequestMapping("/upload-batches")
public class UploadBatchController {

    private final TransactionMockData mockData;

    public UploadBatchController(TransactionMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "카드내역 업로드",
        description = "naturalKey 중복 거래는 건너뛰고(skippedDuplicateCount), 분류 실패 거래는 미분류로 저장한다. "
            + "Idempotency-Key 동작은 api.md 1.6")
    @ApiResponse(responseCode = "400", description = "IDEMPOTENCY_KEY_REQUIRED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "DUPLICATE_FILE, IDEMPOTENCY_KEY_REUSED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "410", description = "IDEMPOTENCY_RESULT_DELETED",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "INVALID_SOURCE_TYPE, EMPTY_TRANSACTIONS, MISSING_NATURAL_KEY",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UploadBatchCreatedResponse create(
        // 누락을 Spring 기본 처리(VALIDATION_ERROR)가 아니라 api.md 의 IDEMPOTENCY_KEY_REQUIRED 로 응답하려고 직접 검사한다
        @Parameter(required = true, description = "24시간 유효. 같은 키 + 같은 요청이면 최초 응답을 재사용한다")
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        @RequestBody CreateUploadBatchRequest request
    ) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key 헤더가 필요합니다.");
        }
        return mockData.createUploadBatch();
    }

    @MockResponse
    @Operation(summary = "업로드 배치 목록", description = "정렬: createdAt DESC")
    @GetMapping
    public PageResponse<UploadBatchResponse> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return mockData.uploadBatches();
    }

    @MockResponse
    @Operation(summary = "배치 상세", description = "목록 items[] 와 같은 형태")
    @GetMapping("/{batchId}")
    public UploadBatchResponse detail(@PathVariable UUID batchId) {
        return mockData.uploadBatch();
    }

    @MockResponse
    @Operation(summary = "배치 및 종속 데이터 삭제",
        description = "Transaction, ClassificationReview, JudgmentRun, Judgment, Question, Batch 범위 UserFact, "
            + "JudgmentOverride 를 함께 삭제한다. StatuteVersion 은 삭제하지 않는다")
    @DeleteMapping("/{batchId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID batchId) {
        // 목 응답: 지울 데이터가 없다
    }
}
