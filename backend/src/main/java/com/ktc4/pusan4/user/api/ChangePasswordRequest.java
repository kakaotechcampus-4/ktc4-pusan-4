package com.ktc4.pusan4.user.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** 새 비밀번호 규칙은 가입과 같다. 서비스가 이유와 함께 검사한다(api.md 3.1). */
public record ChangePasswordRequest(
    @NotBlank String currentPassword,
    @Schema(description = "영문, 숫자, 기호를 모두 넣어 8자 이상, UTF-8 72바이트 이하", example = "new-password2!")
    @NotBlank String newPassword
) {
}
