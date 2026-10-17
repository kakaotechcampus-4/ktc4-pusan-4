package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Objects;

/**
 * 업로드 요청을 검증해 {@link NewUploadBatch} 로 바꾼다 (api.md 3.3 에러).
 *
 * <p>Bean Validation 을 쓰지 않는 이유는 요청 DTO 주석과 같다. 계약이 일부 누락을 400 이 아니라 422 전용 코드로 정했다.
 * 검사 순서: INVALID_SOURCE_TYPE → EMPTY_TRANSACTIONS → MISSING_NATURAL_KEY → 그 밖의 VALIDATION_ERROR.
 * 길이 상한은 컬럼 크기(V1·V8)다. 넘기면 DB 가 500 을 내므로 여기서 400 으로 막는다.
 */
final class UploadRequestValidator {

    private static final int FILE_HASH_MAX = 128;
    private static final int NATURAL_KEY_MAX = 128;
    private static final int APPROVAL_NO_MAX = 32;
    private static final int BIZ_NO_MAX = 20;
    private static final int SOURCE_CARD_MAX = 20;

    private UploadRequestValidator() {
    }

    static NewUploadBatch validate(CreateUploadBatchRequest request) {
        if (request.sourceType() != null && request.sourceType() != SourceType.승인내역) {
            throw unprocessable("INVALID_SOURCE_TYPE", "현재 업로드할 수 있는 소스 유형은 승인내역뿐입니다.");
        }
        if (request.transactions() == null || request.transactions().isEmpty()) {
            throw unprocessable("EMPTY_TRANSACTIONS", "업로드할 거래가 없습니다.");
        }
        if (request.transactions().stream().anyMatch(t -> t == null || isBlank(t.naturalKey()))) {
            throw unprocessable("MISSING_NATURAL_KEY", "naturalKey 가 없는 거래가 있습니다.");
        }

        require(request.sourceType() != null && request.cardIssuer() != null
            && request.periodStart() != null && request.periodEnd() != null
            && !isBlank(request.fileHash()));
        require(!request.periodEnd().isBefore(request.periodStart()));
        require(request.fileHash().length() <= FILE_HASH_MAX);

        List<NewTransaction> transactions = request.transactions().stream()
            .map(UploadRequestValidator::toTransaction)
            .toList();
        return new NewUploadBatch(request.sourceType(), request.cardIssuer(), request.periodStart(),
            request.periodEnd(), request.fileHash(), transactions);
    }

    private static NewTransaction toTransaction(UploadTransactionRequest t) {
        require(t.approvedAt() != null && !isBlank(t.merchantRaw()) && t.amount() != null && t.status() != null);
        int installmentMonths = Objects.requireNonNullElse(t.installmentMonths(), 0);
        require(installmentMonths >= 0);
        require(t.naturalKey().length() <= NATURAL_KEY_MAX);
        require(fits(t.approvalNo(), APPROVAL_NO_MAX) && fits(t.bizNo(), BIZ_NO_MAX) && fits(t.sourceCard(), SOURCE_CARD_MAX));
        return new NewTransaction(
            t.approvedAt(), t.merchantRaw(), t.amount(), t.naturalKey(), t.status(), installmentMonths,
            t.approvalNo(), t.bizNo(), t.branch(), t.branchRaw(), t.memo(),
            Boolean.TRUE.equals(t.isAggregated()), Boolean.TRUE.equals(t.needsReview()),
            t.reviewReason(), t.sourceCard());
    }

    private static void require(boolean valid) {
        if (!valid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "요청 값이 올바르지 않습니다.");
        }
    }

    private static boolean fits(String value, int max) {
        return value == null || value.length() <= max;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static ApiException unprocessable(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }
}
