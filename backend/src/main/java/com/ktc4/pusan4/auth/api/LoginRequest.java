package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @Schema(example = "demo@example.com") @NotBlank String email,
    @NotBlank String password
) {
}
