package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.auth.RefreshTokenStore.RefreshToken;
import com.ktc4.pusan4.auth.RefreshTokenStore.Rotation;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StatelessRefreshTokenStoreTest {

    private static final Instant NOW = Instant.parse("2026-10-18T00:00:00Z");
    private static final Duration TTL = Duration.ofDays(14);
    private static final UUID USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");

    private final SignedTokens tokens = AccessTokensTest.signedTokens("test-secret-test-secret-test-secret!!");

    @Test
    void issued_token_carries_ttl_for_cookie_max_age() {
        RefreshToken token = storeAt(NOW).issue(USER_ID);

        assertThat(token.ttl()).isEqualTo(TTL);
        assertThat(token.value()).isNotBlank();
    }

    @Test
    void rotate_returns_user_and_new_token() {
        RefreshToken token = storeAt(NOW).issue(USER_ID);

        Optional<Rotation> rotation = storeAt(NOW.plusSeconds(60)).rotate(token.value());

        assertThat(rotation).isPresent();
        assertThat(rotation.get().userId()).isEqualTo(USER_ID);
        assertThat(rotation.get().next().value()).isNotEqualTo(token.value());
    }

    @Test
    void expired_token_cannot_rotate() {
        RefreshToken token = storeAt(NOW).issue(USER_ID);

        assertThat(storeAt(NOW.plus(TTL)).rotate(token.value())).isEmpty();
    }

    @Test
    void access_token_cannot_rotate() {
        String access = new AccessTokens(tokens, Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofMinutes(15))
            .issue(USER_ID);

        assertThat(storeAt(NOW).rotate(access)).isEmpty();
    }

    @Test
    void revoke_does_not_invalidate_stateless_token() {
        // 저장소가 없어 폐기할 수 없다. B9c 의 Redis 구현에서 바뀌는 동작이다
        StatelessRefreshTokenStore store = storeAt(NOW);
        RefreshToken token = store.issue(USER_ID);

        store.revoke(token.value());
        store.revokeAll(USER_ID);

        assertThat(store.rotate(token.value())).isPresent();
    }

    private StatelessRefreshTokenStore storeAt(Instant now) {
        return new StatelessRefreshTokenStore(tokens, Clock.fixed(now, ZoneOffset.UTC), TTL);
    }
}
