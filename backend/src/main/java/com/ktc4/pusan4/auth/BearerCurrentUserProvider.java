package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import com.ktc4.pusan4.shared.auth.CurrentUserProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * {@code Authorization: Bearer {accessToken}} 의 사용자 (api.md 1.1). 헤더가 없거나 토큰이 틀리거나 만료됐으면
 * 401 UNAUTHORIZED 다. 프론트는 이 401 을 받으면 /auth/refresh 로 한 번 재발급해 본다.
 */
@Component
class BearerCurrentUserProvider implements CurrentUserProvider {

    private static final String PREFIX = "Bearer ";

    private final AccessTokens accessTokens;

    BearerCurrentUserProvider(AccessTokens accessTokens) {
        this.accessTokens = accessTokens;
    }

    @Override
    public CurrentUser resolve(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, PREFIX, 0, PREFIX.length())) {
            throw unauthorized();
        }
        return accessTokens.verify(header.substring(PREFIX.length()).trim())
            .map(CurrentUser::new)
            .orElseThrow(BearerCurrentUserProvider::unauthorized);
    }

    private static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
    }
}
