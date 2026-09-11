package com.ktc4.pusan4.judgment.domain;

import java.util.Objects;

public record Citation(String statuteId) {
    public Citation {
        Objects.requireNonNull(statuteId, "statuteId must not be null");
    }
}
