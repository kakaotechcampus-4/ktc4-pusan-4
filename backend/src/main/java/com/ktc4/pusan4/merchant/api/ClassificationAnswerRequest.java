package com.ktc4.pusan4.merchant.api;

import com.ktc4.pusan4.transaction.api.MerchantCategories;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record ClassificationAnswerRequest(
    @Schema(requiredMode = REQUIRED) List<UUID> reviewIds,
    @Schema(requiredMode = REQUIRED, description = MerchantCategories.DESCRIPTION + ". 미분류는 제출할 수 없다",
        example = "해외SaaS")
    String merchantCategory
) {
}
