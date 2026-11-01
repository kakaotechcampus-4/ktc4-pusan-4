package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 비밀번호는 8자 이상, UTF-8 72바이트 이하(BCrypt 한계). 바이트 검사는 서비스에서 한다. */
public record SignupRequest(
    @Schema(example = "user@example.com") @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 8, max = 72) String password
) {
}
