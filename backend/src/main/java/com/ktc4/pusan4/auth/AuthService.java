package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.auth.RefreshTokenStore.RefreshToken;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * 로그인·재발급·로그아웃 (api.md 1.1). 자격 확인과 리프레시 토큰 보관은 인터페이스 뒤에 있어,
 * 실제 계정(B9b)·Redis(B9c)를 붙여도 이 클래스는 바뀌지 않는다.
 */
@Service
public class AuthService {

    private final CredentialVerifier credentials;
    private final AccessTokens accessTokens;
    private final RefreshTokenStore refreshTokens;

    AuthService(CredentialVerifier credentials, AccessTokens accessTokens, RefreshTokenStore refreshTokens) {
        this.credentials = credentials;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
    }

    public IssuedTokens login(String email, String password) {
        return credentials.verify(email, password)
            .map(userId -> new IssuedTokens(accessTokens.issue(userId), refreshTokens.issue(userId)))
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                "이메일 또는 비밀번호가 맞지 않습니다."));
    }

    /** @param refreshToken 쿠키 값. 없으면 null */
    public IssuedTokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalidRefreshToken();
        }
        return refreshTokens.rotate(refreshToken)
            .map(rotation -> new IssuedTokens(accessTokens.issue(rotation.userId()), rotation.next()))
            .orElseThrow(AuthService::invalidRefreshToken);
    }

    /** 이미 로그아웃했거나 쿠키가 없어도 실패하지 않는다. */
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokens.revoke(refreshToken);
        }
    }

    private static ApiException invalidRefreshToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "다시 로그인해 주세요.");
    }

    public record IssuedTokens(String accessToken, RefreshToken refreshToken) {
    }
}
