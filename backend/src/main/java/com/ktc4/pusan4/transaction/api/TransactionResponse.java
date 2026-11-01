package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.UUID;

public record TransactionResponse(
    UUID id,
    UUID batchId,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    @Schema(description = MerchantCategories.DESCRIPTION, example = "해외SaaS") String merchantCategory,
    Coded<ClassificationStatus> classificationStatus,
    long amount,
    int installmentMonths,
    Coded<SourceStatus> sourceStatus,
    UserInclusion userInclusion,
    @Schema(description = "sourceStatus 와 userInclusion 으로 계산한 최종 판정 대상 여부 (api.md 2.3)")
    Coded<SourceStatus> effectiveStatus
) {

    static TransactionResponse from(TransactionDetail transaction) {
        return new TransactionResponse(transaction.id(), transaction.batchId(), transaction.approvedAt(),
            transaction.merchantRaw(), transaction.merchantNorm(), transaction.merchantCategory(),
            classificationStatus(transaction.classificationStatus()), transaction.amount(),
            transaction.installmentMonths(), sourceStatus(transaction.sourceStatus()), transaction.userInclusion(),
            sourceStatus(transaction.effectiveStatus()));
    }

    /** 화면 문구는 api.md 2.2 를 따른다. effectiveStatus 도 같은 문구다. */
    static Coded<SourceStatus> sourceStatus(SourceStatus status) {
        String label = switch (status) {
            case JUDGEABLE -> "판정대상";
            case CANCELED_OFFSET -> "취소상계";
            case EXCLUDED -> "대상제외";
        };
        return new Coded<>(status, label);
    }

    /** 화면 문구는 api.md 2.4 를 따른다. */
    static Coded<ClassificationStatus> classificationStatus(ClassificationStatus status) {
        String label = switch (status) {
            case CLASSIFIED -> "분류 완료";
            case NEEDS_REVIEW -> "분류 확인 필요";
        };
        return new Coded<>(status, label);
    }
}
