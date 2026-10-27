package com.ktc4.pusan4.auth;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccessTokensTest {

    private static final Instant NOW = Instant.parse("2026-10-18T00:00:00Z");
    private static final Duration TTL = Duration.ofMinutes(15);
    private static final UUID USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");

    private final SignedTokens tokens = signedTokens("test-secret-test-secret-test-secret!!");

    @Test
    void issued_token_resolves_to_user() {
        AccessTokens accessTokens = accessTokensAt(NOW);

        assertThat(accessTokens.verify(accessTokens.issue(USER_ID))).contains(USER_ID);
    }

    @Test
    void token_expires_after_ttl() {
        String token = accessTokensAt(NOW).issue(USER_ID);

        assertThat(accessTokensAt(NOW.plus(TTL).minusSeconds(1)).verify(token)).contains(USER_ID);
        assertThat(accessTokensAt(NOW.plus(TTL)).verify(token)).isEmpty();
    }

    @Test
    void tampered_token_is_rejected() {
        String token = accessTokensAt(NOW).issue(USER_ID);
        // 서명의 첫 글자를 바꾼다. 마지막 글자는 base64 패딩 비트라 바꿔도 같은 바이트가 될 수 있다
        int signatureStart = token.lastIndexOf('.') + 1;
        char first = token.charAt(signatureStart);
        String tampered = token.substring(0, signatureStart) + (first == 'A' ? 'B' : 'A')
            + token.substring(signatureStart + 1);

        assertThat(accessTokensAt(NOW).verify(tampered)).isEmpty();
    }

    @Test
    void token_signed_with_other_secret_is_rejected() {
        String foreign = new AccessTokens(signedTokens("another-secret-another-secret-another!"),
            Clock.fixed(NOW, ZoneOffset.UTC), TTL).issue(USER_ID);

        assertThat(accessTokensAt(NOW).verify(foreign)).isEmpty();
    }

    @Test
    void garbage_is_rejected() {
        assertThat(accessTokensAt(NOW).verify("not-a-jwt")).isEmpty();
    }

    @Test
    void secret_shorter_than_32_bytes_stops_startup() {
        assertThatThrownBy(() -> new AuthConfiguration().signedTokens("short"))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void blank_secret_still_signs_with_a_temporary_key() throws Exception {
        SignedTokens temporary = new AuthConfiguration().signedTokens("");
        AccessTokens accessTokens = new AccessTokens(temporary, Clock.fixed(NOW, ZoneOffset.UTC), TTL);

        assertThat(accessTokens.verify(accessTokens.issue(USER_ID))).contains(USER_ID);
        assertThat(accessTokensAt(NOW).verify(accessTokens.issue(USER_ID))).isEmpty();
    }

    private AccessTokens accessTokensAt(Instant now) {
        return new AccessTokens(tokens, Clock.fixed(now, ZoneOffset.UTC), TTL);
    }

    static SignedTokens signedTokens(String secret) {
        try {
            return new SignedTokens(secret.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
