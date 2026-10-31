package com.ktc4.pusan4.auth;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * 리프레시 토큰의 발급·교체·폐기. 구현은 {@link RedisRefreshTokenStore} 다.
 * {@link AuthService}·컨트롤러는 이 인터페이스만 본다.
 */
public interface RefreshTokenStore {

    RefreshToken issue(UUID userId);

    /** 유효한 토큰이면 새 토큰을 발급하고 이전 토큰을 폐기한다. 이미 폐기된 토큰을 다시 보내면 그 로그인을 끊는다. */
    Optional<Rotation> rotate(String token);

    /** 로그아웃. 그 토큰만 폐기한다. */
    void revoke(String token);

    /** 탈퇴 등으로 그 사용자의 토큰을 모두 폐기한다. */
    void revokeAll(UUID userId);

    record RefreshToken(String value, Duration ttl) {
    }

    record Rotation(UUID userId, RefreshToken next) {
    }
}
