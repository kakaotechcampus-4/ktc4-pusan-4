package com.ktc4.pusan4.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "액세스 토큰. 리프레시 토큰은 본문이 아니라 Set-Cookie 로 간다 (api.md 1.1)")
public record AccessTokenResponse(String accessToken) {
}
