package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 규칙(영문, 숫자, 기호를 모두 넣어 8자 이상, UTF-8 72바이트 이하)은 서비스가 이유와 함께 검사한다(Passwords).
 * verificationToken 은 {@code POST /auth/email-verification/confirm} 응답의 값이다.
 */
public record SignupRequest(
    @Schema(example = "user@example.com") @NotBlank @Email @Size(max = 320) String email,
    @Schema(description = "영문, 숫자, 기호를 모두 넣어 8자 이상, UTF-8 72바이트 이하", example = "pass-word1")
    @NotBlank String password,
    @NotBlank @Size(max = 64) String verificationToken
) {
}
