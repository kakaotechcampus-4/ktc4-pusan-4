package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EmailVerificationConfirmRequest(
    @Schema(example = "user@example.com") @NotBlank @Email @Size(max = 320) String email,
    @Schema(example = "123456") @NotBlank @Pattern(regexp = "\\d{6}") String code
) {
}
