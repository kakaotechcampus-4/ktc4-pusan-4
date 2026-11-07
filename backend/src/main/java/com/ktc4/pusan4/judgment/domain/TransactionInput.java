package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.util.UUID;

/**
 * @param aggregated 카드사 합산 행(`지하철 40건`)이다. 날짜가 실제 결제일이 아니라 묶음 기준일이다(docs/schema_mapping.md)
 * @param needsReview 파서가 자동으로 정하지 못해 사람이 봐야 한다고 표시했다(취소 대상 불확정, 62일 밖 취소 등,
 *                    docs/schema_mapping.md). 결제가 실제로 남았는지부터 모르니 G0 에서 확인 필요로 멈춘다
 */
public record TransactionInput(
    UUID id,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    String merchantCategory,
    long amount,
    boolean aggregated,
    boolean needsReview
) {
    public TransactionInput(
        UUID id,
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        String merchantCategory,
        long amount,
        boolean aggregated
    ) {
        this(id, approvedAt, merchantRaw, merchantNorm, merchantCategory, amount, aggregated, false);
    }

    public TransactionInput(
        UUID id,
        LocalDate approvedAt,
        String merchantRaw,
        String merchantNorm,
        String merchantCategory,
        long amount
    ) {
        this(id, approvedAt, merchantRaw, merchantNorm, merchantCategory, amount, false);
    }

    public TransactionInput(
        UUID id,
        LocalDate approvedAt,
        String merchantRaw,
        String merchantCategory,
        long amount
    ) {
        this(id, approvedAt, merchantRaw, merchantRaw, merchantCategory, amount);
    }
}
