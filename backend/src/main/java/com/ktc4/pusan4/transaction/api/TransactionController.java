package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "transactions", description = "거래 (api.md 3.4)")
@RestController
@RequestMapping("/transactions")
public class TransactionController {

    private final TransactionMockData mockData;

    public TransactionController(TransactionMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "거래 목록", description = "정렬: approvedAt DESC, id DESC")
    @GetMapping
    public PageResponse<TransactionResponse> list(
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) Integer month,
        @Parameter(description = "effectiveStatus 기준") @RequestParam(required = false) SourceStatus status,
        @RequestParam(required = false) ClassificationStatus classificationStatus,
        @RequestParam(required = false) Verdict verdict,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return mockData.transactions();
    }

    @MockResponse
    @Operation(summary = "거래 상세")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/{transactionId}")
    public TransactionResponse detail(@PathVariable UUID transactionId) {
        return mockData.transaction();
    }

    @MockResponse
    @Operation(summary = "판정 대상에서 제외",
        description = "userInclusion = EXCLUDED. 새 Judgment revision 을 만들지 않는다")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{transactionId}/exclude")
    public TransactionInclusionResponse exclude(@PathVariable UUID transactionId) {
        return mockData.exclude();
    }

    @MockResponse
    @Operation(summary = "판정 대상에 포함",
        description = "userInclusion = INCLUDED. 새 Judgment revision 을 만들지 않는다")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CANCELED_TRANSACTION_NOT_INCLUDABLE",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{transactionId}/include")
    public TransactionInclusionResponse include(@PathVariable UUID transactionId) {
        return mockData.include();
    }
}
