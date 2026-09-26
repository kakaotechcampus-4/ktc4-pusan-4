package com.ktc4.pusan4.transaction.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/**
 * 카드내역 업로드 (api.md 3.3).
 *
 * <p>빈 transactions 는 422 EMPTY_TRANSACTIONS 로 응답해야 해서 Bean Validation 을 걸지 않는다.
 */
public record CreateUploadBatchRequest(
    @Schema(requiredMode = REQUIRED) SourceType sourceType,
    @Schema(requiredMode = REQUIRED) CardIssuer cardIssuer,
    @Schema(requiredMode = REQUIRED) LocalDate periodStart,
    @Schema(requiredMode = REQUIRED) LocalDate periodEnd,
    @Schema(requiredMode = REQUIRED, example = "sha256:abc...",
        description = "프론트가 원본 파일로 계산한다. 서버는 원본을 받지 않아 재계산하지 않는다")
    String fileHash,
    @Schema(requiredMode = REQUIRED) List<UploadTransactionRequest> transactions
) {
}
