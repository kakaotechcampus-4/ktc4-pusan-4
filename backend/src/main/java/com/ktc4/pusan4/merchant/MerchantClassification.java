package com.ktc4.pusan4.merchant;

import java.math.BigDecimal;
import java.util.UUID;

public record MerchantClassification(
    UUID ownerId,
    String pattern,
    String merchantName,
    String category,
    String source,
    String evidence,
    BigDecimal confidence
) {
}
