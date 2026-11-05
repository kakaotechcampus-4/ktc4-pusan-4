package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.util.UUID;

/**
 * @param aggregated 카드사 합산 행(`지하철 40건`)이다. 날짜가 실제 결제일이 아니라 묶음 기준일이다(docs/schema_mapping.md)
 */
public record TransactionInput(
    UUID id,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantNorm,
    String merchantCategory,
    long amount,
    boolean aggregated
) {
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
