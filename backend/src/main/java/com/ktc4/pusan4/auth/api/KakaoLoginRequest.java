package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** 카카오가 프론트 콜백 페이지로 넘긴 인가 코드. 한 번만 쓸 수 있다. */
public record KakaoLoginRequest(@Schema(description = "카카오 인가 코드") @NotBlank String code) {
}
