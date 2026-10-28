package com.ktc4.pusan4.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * 저장소 없는 리프레시 토큰. 서명한 JWT 라 서명·만료만 보면 되고, 그래서 폐기할 수 없다.
 * {@link #revoke}·{@link #revokeAll} 은 아무것도 하지 않는다 — 로그아웃은 쿠키를 지우는 것으로 끝나고,
 * 이미 복사된 토큰은 만료까지 쓸 수 있다. 폐기가 필요해지면(B9c) Redis 구현으로 바꾼다.
 */
@Component
class StatelessRefreshTokenStore implements RefreshTokenStore {

    static final String TYPE = "refresh";

    private final SignedTokens tokens;
    private final Clock clock;
    private final Duration ttl;

    StatelessRefreshTokenStore(SignedTokens tokens, Clock clock,
        @Value("${app.auth.refresh-token-ttl}") Duration ttl) {
        this.tokens = tokens;
        this.clock = clock;
        this.ttl = ttl;
    }

    @Override
    public RefreshToken issue(UUID userId) {
        Instant now = clock.instant();
        return new RefreshToken(tokens.issue(userId, TYPE, now, now.plus(ttl)), ttl);
    }

    @Override
    public Optional<Rotation> rotate(String token) {
        return tokens.verify(token, TYPE, clock.instant())
            .map(userId -> new Rotation(userId, issue(userId)));
    }

    @Override
    public void revoke(String token) {
        // 저장소가 없어 폐기할 대상이 없다
    }

    @Override
    public void revokeAll(UUID userId) {
        // 저장소가 없어 폐기할 대상이 없다
    }
}
