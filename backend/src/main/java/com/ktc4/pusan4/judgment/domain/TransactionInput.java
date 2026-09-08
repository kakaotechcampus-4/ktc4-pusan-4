package com.ktc4.pusan4.judgment.domain;

import java.time.LocalDate;
import java.util.UUID;

public record TransactionInput(
    UUID id,
    LocalDate approvedAt,
    String merchantRaw,
    String merchantCategory,
    long amount
) {
}
