package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 규칙(영문, 숫자, 기호만 써서 셋을 모두 넣은 8~72자. 공백, 한글은 쓸 수 없다)은 서비스가 이유와 함께 검사한다(Passwords).
 * verificationToken 은 {@code POST /auth/email-verification/confirm} 응답의 값이다.
 */
public record SignupRequest(
    @Schema(example = "user@example.com") @NotBlank @Email @Size(max = 320) String email,
    @Schema(description = "영문, 숫자, 기호만 써서 셋을 모두 넣은 8~72자. 공백, 한글은 쓸 수 없다", example = "pass-word1")
    @NotBlank String password,
    @NotBlank @Size(max = 64) String verificationToken
) {
}
