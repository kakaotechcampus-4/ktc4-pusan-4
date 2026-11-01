package com.ktc4.pusan4.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * 액세스 토큰(JWT) 발급과 검증. 저장하지 않고 서명과 만료만 본다. 실제 계정·Redis 를 붙여도(B9b·B9c) 그대로 쓴다.
 */
@Component
public class AccessTokens {

    static final String TYPE = "access";

    private final SignedTokens tokens;
    private final Clock clock;
    private final Duration ttl;

    AccessTokens(SignedTokens tokens, Clock clock, @Value("${app.auth.access-token-ttl}") Duration ttl) {
        this.tokens = tokens;
        this.clock = clock;
        this.ttl = ttl;
    }

    public String issue(UUID userId) {
        Instant now = clock.instant();
        return tokens.issue(userId, TYPE, now, now.plus(ttl));
    }

    public Optional<UUID> verify(String token) {
        return tokens.verify(token, TYPE, clock.instant());
    }
}
