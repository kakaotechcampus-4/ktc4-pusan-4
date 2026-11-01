package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.transaction.domain.TransactionFilter;
import com.ktc4.pusan4.transaction.persistence.TransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @Operation(summary = "거래 목록",
        description = "정렬: approvedAt DESC, id DESC. 조건은 모두 AND. verdict 는 거래의 현재 판정 기준이다")
    @GetMapping
    public PageResponse<TransactionResponse> list(
        CurrentUser currentUser,
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) Integer year,
        @Parameter(description = "1~12. year 없이 주면 모든 해의 그 달")
        @RequestParam(required = false) @Min(1) @Max(12) Integer month,
        @Parameter(description = "effectiveStatus 기준") @RequestParam(required = false) SourceStatus status,
        @RequestParam(required = false) ClassificationStatus classificationStatus,
        @RequestParam(required = false) Verdict verdict,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        TransactionFilter filter = new TransactionFilter(batchId, year, month, status, classificationStatus, verdict);
        return PageResponse.of(transactionService.list(currentUser.id(), filter, page, size)
            .map(TransactionResponse::from));
    }

    @Operation(summary = "거래 상세")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/{transactionId}")
    public TransactionResponse detail(CurrentUser currentUser, @PathVariable UUID transactionId) {
        return TransactionResponse.from(transactionService.get(currentUser.id(), transactionId));
    }

    @Operation(summary = "판정 대상에서 제외",
        description = "userInclusion = EXCLUDED. 새 Judgment revision 을 만들지 않는다")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{transactionId}/exclude")
    public TransactionInclusionResponse exclude(CurrentUser currentUser, @PathVariable UUID transactionId) {
        return TransactionInclusionResponse.from(transactionService.exclude(currentUser.id(), transactionId));
    }

    @Operation(summary = "판정 대상에 포함",
        description = "userInclusion = INCLUDED. 새 Judgment revision 을 만들지 않는다. "
            + "미분류 거래면 대기 중인 분류 검토가 없을 때 새로 만든다")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "CANCELED_TRANSACTION_NOT_INCLUDABLE",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/{transactionId}/include")
    public TransactionInclusionResponse include(CurrentUser currentUser, @PathVariable UUID transactionId) {
        return TransactionInclusionResponse.from(transactionService.include(currentUser.id(), transactionId));
    }
}
