package com.ktc4.pusan4.auth.api;

import com.ktc4.pusan4.auth.RefreshTokenStore.RefreshToken;
import com.ktc4.pusan4.shared.api.WebConfig;
import org.springframework.http.ResponseCookie;

/**
 * 리프레시 토큰 쿠키의 모양은 여기에만 있다 (api.md 1.1).
 *
 * <ul>
 *   <li>HttpOnly — 스크립트가 읽지 못한다. 프론트는 토큰 값을 모르고 fetch 가 실어 보낼 뿐이다.</li>
 *   <li>SameSite=Strict — 배포는 Caddy 뒤 같은 오리진이라 다른 사이트에서 보낼 일이 없다.</li>
 *   <li>Path=/api/v1/auth — 인증 API 에만 실린다. 다른 API 요청에는 붙지 않는다.</li>
 *   <li>Domain 없음 — 붙이면 개발 중 vite 프록시 뒤에서 브라우저가 쿠키를 버린다(#142).</li>
 *   <li>Secure — 설정(app.auth.cookie-secure). 로컬 http 에서만 끈다.</li>
 * </ul>
 */
class RefreshCookie {

    static final String NAME = "refresh_token";
    private static final String PATH = WebConfig.API_PREFIX + "/auth";

    private final boolean secure;

    RefreshCookie(boolean secure) {
        this.secure = secure;
    }

    String issue(RefreshToken token) {
        return base(token.value()).maxAge(token.ttl()).build().toString();
    }

    String clear() {
        return base("").maxAge(0).build().toString();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(NAME, value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path(PATH);
    }
}
