package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.auth.RefreshTokenStore.RefreshToken;
import com.ktc4.pusan4.auth.RefreshTokenStore.Rotation;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Redis 저장 규칙(docs/backend_api_plan.md "저장소 결정")을 실제 Redis 로 확인한다. 스프링 컨텍스트 없이 저장소만 띄운다.
 */
@Testcontainers
class RedisRefreshTokenStoreIntegrationTest {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7.4-alpine").withExposedPorts(6379);

    private static final Instant NOW = Instant.parse("2026-10-26T00:00:00Z");
    private static final Duration TTL = Duration.ofDays(14);
    private static final UUID USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
    private static final UUID OTHER_USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000002");

    private static LettuceConnectionFactory connectionFactory;
    private static StringRedisTemplate redis;

    private final SignedTokens tokens = AccessTokensTest.signedTokens("test-secret-test-secret-test-secret!!");

    @BeforeAll
    static void connect() {
        connectionFactory = new LettuceConnectionFactory(
            new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();
        redis = new StringRedisTemplate(connectionFactory);
    }

    @AfterAll
    static void disconnect() {
        connectionFactory.destroy();
    }

    @BeforeEach
    void flush() {
        redis.execute(connection -> {
            connection.serverCommands().flushAll();
            return null;
        }, true);
    }

    @Test
    void issue_stores_hash_with_ttl_not_token() {
        // when
        RefreshToken token = storeAt(NOW).issue(USER_ID);

        // then
        Set<String> families = redis.opsForSet().members("user:" + USER_ID + ":families");
        assertThat(families).hasSize(1);
        String familyKey = "refresh:" + families.iterator().next();
        assertThat(redis.opsForHash().get(familyKey, "userId")).isEqualTo(USER_ID.toString());
        assertThat(redis.opsForHash().get(familyKey, "tokenHash")).isNotNull().isNotEqualTo(token.value());
        assertThat(redis.getExpire(familyKey)).isPositive().isLessThanOrEqualTo(TTL.toSeconds());
        assertThat(redis.getExpire("user:" + USER_ID + ":families")).isPositive();
    }

    @Test
    void rotate_returns_user_and_new_token_in_same_login() {
        RefreshToken token = storeAt(NOW).issue(USER_ID);

        Optional<Rotation> rotation = storeAt(NOW.plusSeconds(60)).rotate(token.value());

        assertThat(rotation).isPresent();
        assertThat(rotation.get().userId()).isEqualTo(USER_ID);
        assertThat(rotation.get().next().value()).isNotEqualTo(token.value());
        assertThat(redis.opsForSet().size("user:" + USER_ID + ":families")).isEqualTo(1);
    }

    @Test
    void reusing_rotated_token_revokes_that_login() {
        RefreshTokenStore store = storeAt(NOW);
        RefreshToken old = store.issue(USER_ID);
        RefreshToken next = store.rotate(old.value()).orElseThrow().next();

        // when: 이미 쓴 토큰을 다시 보낸다
        assertThat(store.rotate(old.value())).isEmpty();

        // then: 그 로그인이 끊겨 새 토큰도 쓸 수 없다
        assertThat(store.rotate(next.value())).isEmpty();
        assertThat(redis.opsForSet().size("user:" + USER_ID + ":families")).isZero();
    }

    @Test
    void revoke_logs_out_only_that_login() {
        RefreshTokenStore store = storeAt(NOW);
        RefreshToken loggedOut = store.issue(USER_ID);
        RefreshToken otherDevice = store.issue(USER_ID);

        store.revoke(loggedOut.value());

        assertThat(store.rotate(loggedOut.value())).isEmpty();
        assertThat(store.rotate(otherDevice.value())).isPresent();
    }

    @Test
    void revoke_all_removes_every_login_of_that_user_only() {
        RefreshTokenStore store = storeAt(NOW);
        RefreshToken first = store.issue(USER_ID);
        RefreshToken second = store.issue(USER_ID);
        RefreshToken other = store.issue(OTHER_USER_ID);

        store.revokeAll(USER_ID);

        assertThat(store.rotate(first.value())).isEmpty();
        assertThat(store.rotate(second.value())).isEmpty();
        assertThat(redis.hasKey("user:" + USER_ID + ":families")).isFalse();
        assertThat(store.rotate(other.value())).isPresent();
    }

    @Test
    void expired_token_cannot_rotate() {
        RefreshToken token = storeAt(NOW).issue(USER_ID);

        assertThat(storeAt(NOW.plus(TTL)).rotate(token.value())).isEmpty();
    }

    @Test
    void token_without_family_cannot_rotate() {
        // 저장소가 없던 때(#155) 발급한 리프레시 토큰. 배포 뒤 한 번 다시 로그인하게 된다
        String stateless = tokens.issue(USER_ID, RedisRefreshTokenStore.TYPE, NOW, NOW.plus(TTL));

        assertThat(storeAt(NOW).rotate(stateless)).isEmpty();
    }

    @Test
    void access_token_cannot_rotate() {
        String access = new AccessTokens(tokens, Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofMinutes(15))
            .issue(USER_ID);

        assertThat(storeAt(NOW).rotate(access)).isEmpty();
    }

    private RedisRefreshTokenStore storeAt(Instant now) {
        return new RedisRefreshTokenStore(redis, tokens, Clock.fixed(now, ZoneOffset.UTC), TTL);
    }
}
