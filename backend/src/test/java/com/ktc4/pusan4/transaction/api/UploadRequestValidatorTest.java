package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.NewUploadBatch;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UploadRequestValidatorTest {

    @Test
    void fills_optional_defaults() {
        NewUploadBatch batch = UploadRequestValidator.validate(request(SourceType.승인내역, List.of(tx("k-1"))));

        NewTransaction t = batch.transactions().get(0);
        assertThat(t.installmentMonths()).isZero();
        assertThat(t.aggregated()).isFalse();
        assertThat(t.needsReview()).isFalse();
        assertThat(t.amount()).isEqualTo(11_000L);
    }

    @Test
    void only_approval_source_type_is_accepted() {
        assertError(request(SourceType.청구내역, List.of(tx("k-1"))), HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_SOURCE_TYPE");
        assertError(request(SourceType.판별불가, List.of(tx("k-1"))), HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_SOURCE_TYPE");
    }

    @Test
    void empty_or_missing_transactions_is_empty_transactions() {
        assertError(request(SourceType.승인내역, List.of()), HttpStatus.UNPROCESSABLE_ENTITY, "EMPTY_TRANSACTIONS");
        assertError(request(SourceType.승인내역, null), HttpStatus.UNPROCESSABLE_ENTITY, "EMPTY_TRANSACTIONS");
    }

    @Test
    void blank_natural_key_is_missing_natural_key() {
        assertError(request(SourceType.승인내역, List.of(tx("k-1"), tx(" "))), HttpStatus.UNPROCESSABLE_ENTITY, "MISSING_NATURAL_KEY");
        assertError(request(SourceType.승인내역, List.of(tx(null))), HttpStatus.UNPROCESSABLE_ENTITY, "MISSING_NATURAL_KEY");
        List<UploadTransactionRequest> withNull = new ArrayList<>(Collections.singletonList(null));
        assertError(request(SourceType.승인내역, withNull), HttpStatus.UNPROCESSABLE_ENTITY, "MISSING_NATURAL_KEY");
    }

    @Test
    void source_type_check_comes_before_empty_check() {
        assertError(request(SourceType.청구내역, List.of()), HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_SOURCE_TYPE");
    }

    @Test
    void other_missing_or_out_of_range_values_are_validation_error() {
        assertError(new CreateUploadBatchRequest(SourceType.승인내역, null, LocalDate.parse("2026-01-01"),
            LocalDate.parse("2026-01-31"), "h", List.of(tx("k"))), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
        assertError(new CreateUploadBatchRequest(SourceType.승인내역, CardIssuer.국민, LocalDate.parse("2026-02-01"),
            LocalDate.parse("2026-01-31"), "h", List.of(tx("k"))), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
        assertError(new CreateUploadBatchRequest(SourceType.승인내역, CardIssuer.국민, LocalDate.parse("2026-01-01"),
            LocalDate.parse("2026-01-31"), "h".repeat(129), List.of(tx("k"))), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");

        UploadTransactionRequest noAmount = new UploadTransactionRequest(LocalDate.parse("2026-01-03"), "가맹점", null,
            "k", SourceStatus.JUDGEABLE, null, null, null, null, null, null, null, null, null, null);
        assertError(request(SourceType.승인내역, List.of(noAmount)), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");

        UploadTransactionRequest negativeInstallment = new UploadTransactionRequest(LocalDate.parse("2026-01-03"), "가맹점",
            1000L, "k", SourceStatus.JUDGEABLE, -1, null, null, null, null, null, null, null, null, null);
        assertError(request(SourceType.승인내역, List.of(negativeInstallment)), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");

        UploadTransactionRequest longApprovalNo = new UploadTransactionRequest(LocalDate.parse("2026-01-03"), "가맹점",
            1000L, "k", SourceStatus.JUDGEABLE, 0, "1".repeat(33), null, null, null, null, null, null, null, null);
        assertError(request(SourceType.승인내역, List.of(longApprovalNo)), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    }

    private static void assertError(CreateUploadBatchRequest request, HttpStatus status, String code) {
        assertThatThrownBy(() -> UploadRequestValidator.validate(request))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus()).isEqualTo(status);
                assertThat(e.getCode()).isEqualTo(code);
            });
    }

    private static CreateUploadBatchRequest request(SourceType sourceType, List<UploadTransactionRequest> transactions) {
        return new CreateUploadBatchRequest(sourceType, CardIssuer.국민, LocalDate.parse("2026-01-01"),
            LocalDate.parse("2026-01-31"), "sha256:abc", transactions);
    }

    private static UploadTransactionRequest tx(String naturalKey) {
        return new UploadTransactionRequest(LocalDate.parse("2026-01-03"), "스타벅스코리아 서면점", 11_000L, naturalKey,
            SourceStatus.JUDGEABLE, null, null, null, null, null, null, null, null, null, null);
    }
}
