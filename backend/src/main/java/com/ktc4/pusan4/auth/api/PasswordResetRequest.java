package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * verificationToken 은 {@code POST /auth/password-reset/confirm} 응답의 값이다. 가입 인증 토큰은 쓸 수 없다.
 * 새 비밀번호 규칙은 가입과 같고 서비스가 이유와 함께 검사한다.
 */
public record PasswordResetRequest(
    @Schema(example = "user@example.com") @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(max = 64) String verificationToken,
    @Schema(description = "영문, 숫자, 기호를 모두 넣어 8자 이상, UTF-8 72바이트 이하", example = "new-password2!")
    @NotBlank String newPassword
) {
}
